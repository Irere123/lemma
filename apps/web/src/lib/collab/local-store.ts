import * as Y from 'yjs'

// Keeps a copy of a document's Yjs updates in IndexedDB, written as each edit
// happens, so a crash, a killed tab or closing the laptop offline loses
// nothing: the next open replays it and syncs it to the server.
//
// Unlike y-indexeddb, every write is tracked to completion, so the UI can say
// "saved on this device" truthfully.

const STORE = 'updates'
const COMPACT_AFTER = 300
// While the server has the edits too, they're batched into one IndexedDB
// write per frame-ish window, so a burst of typing costs one transaction, not
// one per keystroke. Offline this copy is the only one: see `immediate`.
const BATCH_MS = 50

export class LocalDocumentStore {
  readonly loaded: Promise<void>
  private db: IDBDatabase | null = null
  private batch: Uint8Array[] = []
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private pending = 0
  private count = 0
  private failed = false
  private readonly listeners = new Set<() => void>()
  /**
   * Write each edit as it happens instead of batching. Set while the server
   * isn't confirming edits (offline), when a crash inside the batch window
   * would otherwise lose the last keystrokes.
   */
  immediate = false

  constructor(
    private readonly name: string,
    private readonly doc: Y.Doc
  ) {
    this.loaded = this.open().catch((error) => {
      console.error('Local document store unavailable', error)
      this.failed = true
      this.emit()
    })
    doc.on('update', this.onUpdate)
  }

  /** Every edit so far has been written to this device. */
  get settled(): boolean {
    return !this.failed && this.db !== null && this.pending === 0 && this.batch.length === 0
  }

  get available(): boolean {
    return !this.failed
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  destroy(): void {
    this.flush()
    this.doc.off('update', this.onUpdate)
    this.db?.close()
    this.db = null
    this.listeners.clear()
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }

  private async open(): Promise<void> {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.name, 1)
      request.onupgradeneeded = () =>
        request.result.createObjectStore(STORE, { autoIncrement: true })
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const updates = await new Promise<Uint8Array[]>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
      request.onsuccess = () => resolve(request.result as Uint8Array[])
      request.onerror = () => reject(request.error)
    })
    this.count = updates.length
    if (updates.length > 0) {
      this.doc.transact(() => {
        for (const update of updates) Y.applyUpdate(this.doc, update, this)
      }, this)
    }
    this.db = db
    // Edits made before IndexedDB opened (rare) are captured in one write.
    const editedWhileOpening = this.pending > 0
    this.pending = 0
    if (editedWhileOpening) this.write(Y.encodeStateAsUpdate(this.doc))
    this.emit()
  }

  private onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return
    if (!this.db) {
      // Still opening: open() writes the whole state once it's ready.
      this.pending = Math.max(this.pending, 1)
      return
    }
    this.batch.push(update)
    if (this.immediate) {
      this.flush()
      return
    }
    if (this.batch.length === 1) this.emit()
    if (!this.batchTimer) this.batchTimer = setTimeout(() => this.flush(), BATCH_MS)
  }

  /** Write any batched edits now. */
  flush(): void {
    if (this.batchTimer) clearTimeout(this.batchTimer)
    this.batchTimer = null
    if (this.batch.length === 0 || !this.db) return
    const updates = this.batch
    this.batch = []
    this.write(updates.length === 1 ? (updates[0] as Uint8Array) : Y.mergeUpdates(updates))
  }

  private write(update: Uint8Array) {
    const db = this.db
    if (!db) return
    this.pending += 1
    this.emit()
    const compact = this.count + 1 >= COMPACT_AFTER
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    if (compact) {
      store.clear()
      store.add(Y.encodeStateAsUpdate(this.doc))
    } else {
      store.add(update)
    }
    tx.oncomplete = () => {
      this.count = compact ? 1 : this.count + 1
      this.pending -= 1
      this.emit()
    }
    tx.onerror = tx.onabort = () => {
      this.pending -= 1
      this.failed = true
      this.emit()
    }
  }
}

const DATABASE_PREFIX = 'lemma-document:'
const UNSYNCED_PREFIX = 'lemma-unsynced:'

export const localDatabaseName = (documentId: string) => `${DATABASE_PREFIX}${documentId}`

/** Remember which documents hold edits the server hasn't confirmed yet. */
export function markUnsynced(documentId: string, unsynced: boolean): void {
  try {
    if (unsynced) localStorage.setItem(UNSYNCED_PREFIX + documentId, '1')
    else localStorage.removeItem(UNSYNCED_PREFIX + documentId)
  } catch {
    // storage unavailable (private mode); nothing to track
  }
}

/**
 * Remove the document copies kept on this device (on sign-out), except those
 * holding edits that never reached the server: losing work is worse than
 * leaving a copy behind, and they sync the next time the writer opens them.
 */
export async function clearLocalDocuments(): Promise<void> {
  if (typeof indexedDB === 'undefined' || !indexedDB.databases) return
  const databases = await indexedDB.databases()
  const unsynced = (name: string) => {
    try {
      return localStorage.getItem(UNSYNCED_PREFIX + name.slice(DATABASE_PREFIX.length)) !== null
    } catch {
      return true
    }
  }
  await Promise.all(
    databases
      .filter((db) => db.name?.startsWith(DATABASE_PREFIX) && !unsynced(db.name))
      .map(
        (db) =>
          new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(db.name as string)
            request.onsuccess = request.onerror = request.onblocked = () => resolve()
          })
      )
  )
}
