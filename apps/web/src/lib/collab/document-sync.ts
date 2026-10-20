import {
  BODY_FIELD,
  CLOSE_OUTDATED_EDITOR,
  MESSAGE_SAVED,
  MESSAGE_SYNC,
  META_FIELD,
  readSchemaVersion,
  SCHEMA_VERSION,
  SCHEMA_VERSION_PARAM,
  SUBTITLE_FIELD,
  SYNC_STEP_2,
  SYNC_UPDATE,
  TITLE_FIELD,
} from '@lemma/content/yjs'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

import { realtimeUrl } from '@/lib/realtime'
import { LocalDocumentStore, localDatabaseName, markUnsynced } from './local-store'

export type SaveState =
  /** The server has confirmed every edit. */
  | 'saved'
  /** Connected; edits are on their way and stored on this device. */
  | 'saving'
  /** Not connected; edits are stored on this device and will sync later. */
  | 'offline'
  /** Not connected and this device couldn't store them either. */
  | 'unsaved'

export type SyncSnapshot = {
  /** Content is available to edit (from this device or the server). */
  ready: boolean
  save: SaveState
  connected: boolean
  /** The document was deleted or access was revoked (server closed for good). */
  closed: boolean
  /**
   * The document uses a newer schema than this page's code: editing must stop
   * until the page reloads (an older editor would drop what it doesn't know).
   * Edits already made are kept on this device and sync after the reload.
   */
  outdated: boolean
}

// Reconnect (and so re-send everything) if the server hasn't confirmed an
// edit within this long while connected.
const ACK_TIMEOUT_MS = 10_000

/**
 * Keeps one document in sync: a Yjs doc backed by IndexedDB on this device
 * and by the document's room on the server.
 *
 * "Saved" is precise: the room confirms (MESSAGE_SAVED) each sync message
 * after storing it, in order, and every reconnect starts with a full resync
 * whose confirmation proves the server has everything this device has.
 */
export class DocumentSync {
  readonly doc = new Y.Doc()
  readonly provider: WebsocketProvider
  readonly local: LocalDocumentStore
  readonly title: Y.Text
  readonly subtitle: Y.Text

  private snapshot: SyncSnapshot = {
    ready: false,
    save: 'saving',
    connected: false,
    closed: false,
    outdated: false,
  }
  private readonly listeners = new Set<() => void>()
  private sent = 0
  private acked = 0
  // Index (in `sent`) of this connection's full resync (our sync step 2).
  private resyncAt: number | null = null
  private ackTimer: ReturnType<typeof setTimeout> | null = null
  private closed = false
  private outdated = false

  constructor(readonly documentId: string) {
    this.title = this.doc.getText(TITLE_FIELD)
    this.subtitle = this.doc.getText(SUBTITLE_FIELD)
    this.local = new LocalDocumentStore(localDatabaseName(documentId), this.doc)

    // Count what we send to the server so acks can be matched in order.
    const sync = this
    class CountingSocket extends WebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols)
        sync.sent = 0
        sync.acked = 0
        sync.resyncAt = null
      }
      override send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (data instanceof Uint8Array && data[0] === MESSAGE_SYNC) {
          if (data[1] === SYNC_STEP_2 || data[1] === SYNC_UPDATE)
            sync.onSent(data[1] === SYNC_STEP_2)
        }
        super.send(data)
      }
    }

    this.provider = new WebsocketProvider(
      realtimeUrl('/realtime/documents'),
      documentId,
      this.doc,
      {
        connect: false,
        WebSocketPolyfill: CountingSocket as unknown as typeof WebSocket,
        maxBackoffTime: 10_000,
        params: { [SCHEMA_VERSION_PARAM]: String(SCHEMA_VERSION) },
      }
    )
    this.provider.messageHandlers[MESSAGE_SAVED] = () => this.onAck()
    this.provider.on('status', () => this.update())
    this.provider.on('sync', () => this.update())
    this.provider.on('closed', (event) => {
      if (event.code === CLOSE_OUTDATED_EDITOR) this.markOutdated()
      else this.closed = true
      this.update()
    })
    this.doc.on('update', this.onDocUpdate)
    this.doc.getMap(META_FIELD).observe(this.checkSchema)
    this.local.subscribe(() => this.update())

    // Open from this device first, then connect.
    void this.local.loaded.then(() => {
      this.checkSchema()
      if (!this.outdated) this.provider.connect()
      this.update()
    })
  }

  getSnapshot = (): SyncSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** True if this device already holds a copy of the document. */
  get hasLocalCopy(): boolean {
    return this.doc.getXmlFragment(BODY_FIELD).length > 0 || this.title.length > 0
  }

  /** Unsaved-to-server work exists (used by the leave-page guard). */
  get hasUnconfirmedEdits(): boolean {
    return this.snapshot.ready && this.snapshot.save !== 'saved'
  }

  destroy(): void {
    if (this.ackTimer) clearTimeout(this.ackTimer)
    this.doc.off('update', this.onDocUpdate)
    this.doc.getMap(META_FIELD).unobserve(this.checkSchema)
    this.provider.destroy()
    this.local.destroy()
    this.doc.destroy()
    this.listeners.clear()
  }

  private onSent(isResync: boolean) {
    this.sent += 1
    if (isResync && this.resyncAt === null) this.resyncAt = this.sent
    if (!this.ackTimer) {
      this.ackTimer = setTimeout(() => {
        this.ackTimer = null
        // No confirmation: reconnect now (a plain close() waits for the closing
        // handshake); the new connection's resync resends everything.
        if (this.acked < this.sent) {
          this.provider.disconnect()
          this.provider.connect()
        }
      }, ACK_TIMEOUT_MS)
    }
    this.update()
  }

  private onAck() {
    this.acked += 1
    if (this.acked >= this.sent && this.ackTimer) {
      clearTimeout(this.ackTimer)
      this.ackTimer = null
    }
    this.update()
  }

  private onDocUpdate = () => this.update()

  // A copy on this device (written by a newer tab) or a server document newer
  // than this code: stop syncing before the editor touches it.
  private checkSchema = () => {
    if (readSchemaVersion(this.doc) > SCHEMA_VERSION) this.markOutdated()
  }

  private markOutdated() {
    if (this.outdated) return
    this.outdated = true
    this.provider.disconnect()
    this.update()
  }

  private update() {
    const connected = this.provider.wsconnected
    // Offline, this device holds the only copy of new edits: write them at once.
    this.local.immediate = !connected
    // Saved = the resync is confirmed (server has all we had when we
    // connected) and so is everything sent since.
    const confirmed =
      connected && this.resyncAt !== null && this.acked >= this.resyncAt && this.acked >= this.sent
    let save: SaveState
    if (confirmed) save = 'saved'
    else if (connected) save = 'saving'
    else save = this.local.available ? 'offline' : 'unsaved'

    const localLoaded = this.local.settled || !this.local.available
    const ready =
      this.snapshot.ready || (localLoaded && (this.hasLocalCopy || this.provider.synced))

    if (save !== this.snapshot.save && ready) markUnsynced(this.documentId, save !== 'saved')

    const next: SyncSnapshot = {
      ready,
      save,
      connected,
      closed: this.closed,
      outdated: this.outdated,
    }
    if (
      next.ready !== this.snapshot.ready ||
      next.save !== this.snapshot.save ||
      next.connected !== this.snapshot.connected ||
      next.closed !== this.snapshot.closed ||
      next.outdated !== this.snapshot.outdated
    ) {
      this.snapshot = next
      for (const listener of this.listeners) listener()
    }
  }
}
