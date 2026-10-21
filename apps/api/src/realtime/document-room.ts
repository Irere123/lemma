import { countWords, extractText } from '@lemma/content'
import { markdownToContent } from '@lemma/content/markdown'
import type { JSONContent } from '@lemma/content/schema'
import {
  BODY_FIELD,
  CLOSE_OUTDATED_EDITOR,
  createYDoc,
  type DocumentFields,
  MESSAGE_AWARENESS,
  MESSAGE_QUERY_AWARENESS,
  MESSAGE_SAVED,
  MESSAGE_SYNC,
  META_FIELD,
  migrateYDoc,
  readFields,
  readSchemaVersion,
  SCHEMA_VERSION,
  SCHEMA_VERSION_PARAM,
  SUBTITLE_FIELD,
  SYNC_STEP_2,
  SYNC_UPDATE,
  TITLE_FIELD,
  writeFields,
} from '@lemma/content/yjs'
import { and, eq, isNull } from 'drizzle-orm'
import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as syncProtocol from 'y-protocols/sync'
import * as Y from 'yjs'

import { createDb } from '@api/db'
import { documentLegacyBodies, documents } from '@api/db/schema'
import { type CloudflareBindings, setRuntimeEnv } from '@api/env-runtime'
import { persistDerived } from '@api/lib/documents/persist'
import { rehostImages } from '@api/lib/documents/rehost-images'
import {
  LARGE_DELETE_CHARS,
  LARGE_DELETE_MIN_INTERVAL_MS,
  REVISION_INTERVAL_MS,
  REVISION_SESSION_IDLE_MS,
  type RevisionReason,
  type RevisionSummary,
  revisionsToPrune,
} from '@api/lib/documents/revisions'
import { searchPattern, type TextSearch } from '@api/lib/documents/text-search'
import { DurableObject } from 'cloudflare:workers'

/**
 * One Durable Object per document: the source of truth for its title,
 * subtitle and body, held as a Yjs document.
 *
 * - Every update is written to the object's SQLite storage before its sender
 *   is told it's saved (MESSAGE_SAVED), and edits from several tabs or
 *   devices merge instead of overwriting each other.
 * - Storage is an append-only update log plus a snapshot split into ≤1 MB
 *   parts, compacted as it grows, so no size of document hits a row limit.
 * - A few seconds after edits stop, the derived read model in D1 (title,
 *   excerpt, counts, published HTML, search index) is refreshed.
 * - Documents created before rooms existed are seeded once from their D1
 *   columns, which are then archived to document_legacy_bodies.
 * - Revision history (see lib/documents/revisions.ts) is kept here too, as
 *   compressed Yjs states.
 * - Documents are migrated to the current SCHEMA_VERSION on load, and
 *   editors running an older schema are turned away until they reload.
 */

const SNAPSHOT_PART_BYTES = 1024 * 1024
const COMPACT_AFTER_UPDATES = 500
const COMPACT_AFTER_BYTES = 2 * 1024 * 1024
// A single update this large is folded straight into the snapshot.
const LARGE_UPDATE_BYTES = 512 * 1024

const FLUSH_IDLE_MS = 2_000
const FLUSH_MAX_DELAY_MS = 15_000
const SEARCH_MIN_INTERVAL_MS = 60_000
const SHORT_SEARCH_INTERVAL_MS = 3_000
const SHORT_DOCUMENT_WORDS = 5_000

const ORIGIN_SERVER = 'server'

// The server is older than the document or the editor (a deploy is rolling
// out or was rolled back): ask the editor to retry later. 45xx = transient.
const CLOSE_TRY_LATER = 4503

const SAVED = (() => {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, MESSAGE_SAVED)
  return encoding.toUint8Array(encoder)
})()

type SocketAttachment = { awarenessClients: number[] }

export class DocumentRoom extends DurableObject<CloudflareBindings> {
  private documentId: string | null = null
  private doc: Y.Doc | null = null
  private awareness: awarenessProtocol.Awareness | null = null
  private loading: Promise<Y.Doc> | null = null
  private flushing: Promise<unknown> = Promise.resolve()
  private updateCount = 0
  private updateBytes = 0
  private dirtySince: number | null = null
  // Set by afterTransaction when an edit deleted a lot; onUpdate then keeps a
  // revision of the state before it.
  private largeDelete = false
  // Restores and migrations capture their own revision first.
  private capturingExplicitly = false

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env)
    setRuntimeEnv(env)
    ctx.blockConcurrencyWhile(async () => {
      this.initStorage()
      this.documentId = this.getMeta('documentId')
    })
  }

  private initStorage(): void {
    const sql = this.ctx.storage.sql
    sql.exec(
      'CREATE TABLE IF NOT EXISTS updates (id INTEGER PRIMARY KEY AUTOINCREMENT, data BLOB NOT NULL)'
    )
    sql.exec('CREATE TABLE IF NOT EXISTS snapshot (part INTEGER PRIMARY KEY, data BLOB NOT NULL)')
    sql.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    sql.exec(
      `CREATE TABLE IF NOT EXISTS revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        reason TEXT NOT NULL,
        words INTEGER NOT NULL,
        title TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        encoding TEXT NOT NULL,
        bytes INTEGER NOT NULL
      )`
    )
    sql.exec(
      `CREATE TABLE IF NOT EXISTS revision_parts (
        revision_id INTEGER NOT NULL,
        part INTEGER NOT NULL,
        data BLOB NOT NULL,
        PRIMARY KEY (revision_id, part)
      )`
    )
  }

  // --- RPC (from the API Worker) ---

  /** DOs don't know their own name; the Worker tells us before anything else. */
  async ensure(documentId: string): Promise<void> {
    if (this.documentId === documentId) return
    this.documentId = documentId
    this.setMeta('documentId', documentId)
  }

  async read(): Promise<DocumentFields> {
    return readFields(await this.ready())
  }

  /**
   * Apply an edit from the REST/GraphQL/tRPC API (already validated). It is
   * written as a minimal diff, so open editors merge it like a remote edit.
   * Returns once D1 reflects it.
   */
  async applyEdit(
    fields: Partial<DocumentFields>,
    options: { revisionBefore?: RevisionReason } = {}
  ): Promise<void> {
    const doc = await this.ready()
    if (readSchemaVersion(doc) > SCHEMA_VERSION) {
      throw new Error('This document was written by a newer version of Lemma')
    }
    // Structural edits (split, merge, move) keep the state before them.
    if (options.revisionBefore)
      await this.captureRevision(doc, options.revisionBefore, { force: true })
    this.capturingExplicitly = Boolean(options.revisionBefore)
    try {
      writeFields(doc, fields, ORIGIN_SERVER)
    } finally {
      this.capturingExplicitly = false
    }
    await this.flush({ touch: true, forceSearch: true })
  }

  /**
   * Bring D1's derived copy up to date now. Pass `revision: 'publish'` when
   * the post was just published, to keep that version in its history.
   */
  async flushNow(options: { revision?: 'publish' } = {}): Promise<void> {
    await this.flush({ touch: false, forceSearch: true, force: true })
    if (options.revision) {
      const doc = await this.ready()
      await this.captureRevision(doc, options.revision)
    }
  }

  async listRevisions(): Promise<RevisionSummary[]> {
    return this.ctx.storage.sql
      .exec<RevisionSummary>(
        'SELECT id, created_at AS createdAt, reason, words, title FROM revisions ORDER BY id DESC'
      )
      .toArray()
      .map((row) => ({ ...row }))
  }

  /** A past version's fields, migrated to the current schema. */
  async getRevision(id: number): Promise<(RevisionSummary & { fields: DocumentFields }) | null> {
    const summary = this.ctx.storage.sql
      .exec<RevisionSummary>(
        'SELECT id, created_at AS createdAt, reason, words, title FROM revisions WHERE id = ?',
        id
      )
      .toArray()[0]
    if (!summary) return null
    const revision = await this.loadRevision(id)
    if (!revision) return null
    const fields = readFields(revision)
    revision.destroy()
    return { ...summary, fields }
  }

  /**
   * Make a past version current again. It's applied as an ordinary edit (so
   * open editors merge it), after keeping the present state as a revision.
   */
  async restoreRevision(id: number): Promise<boolean> {
    const doc = await this.ready()
    const revision = await this.loadRevision(id)
    if (!revision) return false
    const fields = readFields(revision)
    revision.destroy()
    await this.captureRevision(doc, 'before-restore', { force: true })
    this.capturingExplicitly = true
    try {
      writeFields(doc, fields, ORIGIN_SERVER)
    } finally {
      this.capturingExplicitly = false
    }
    await this.flush({ touch: true, forceSearch: true })
    return true
  }

  /** Fields plus what rendering needs from the room's meta (the citation style). */
  async readForRender(): Promise<{ fields: DocumentFields; citationStyle: string | null }> {
    const doc = await this.ready()
    const style = doc.getMap(META_FIELD).get('citationStyle')
    return { fields: readFields(doc), citationStyle: typeof style === 'string' ? style : null }
  }

  /**
   * Replace every match of `find` in the title, subtitle and body, keeping
   * each match's formatting. The state before is kept as a revision, so the
   * whole replace can be undone by restoring it. Returns the number replaced.
   */
  async replaceText(input: TextSearch & { replace: string }): Promise<number> {
    const doc = await this.ready()
    if (readSchemaVersion(doc) > SCHEMA_VERSION) {
      throw new Error('This document was written by a newer version of Lemma')
    }
    const pattern = searchPattern(input)
    if (!pattern) return 0
    const runs = textRuns(doc)
    let count = 0
    for (const run of runs) count += [...plainOf(run).matchAll(pattern)].length
    if (count === 0) return 0
    await this.captureRevision(doc, 'before-replace', { force: true })
    this.capturingExplicitly = true
    try {
      doc.transact(() => {
        for (const run of runs) {
          const delta = run.toDelta() as { insert: unknown; attributes?: Record<string, unknown> }[]
          const plain = plainOf(run, delta)
          // Back to front, so earlier offsets stay valid.
          for (const match of [...plain.matchAll(pattern)].reverse()) {
            const index = match.index ?? 0
            const attributes = attributesAt(delta, index)
            run.delete(index, match[0].length)
            if (input.replace) run.insert(index, input.replace, attributes)
          }
        }
      }, ORIGIN_SERVER)
    } finally {
      this.capturingExplicitly = false
    }
    await this.flush({ touch: true, forceSearch: true })
    return count
  }

  /** The document was deleted: drop everything and disconnect editors. */
  async destroy(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) ws.close(4404, 'Document deleted')
    await this.ctx.storage.deleteAlarm()
    await this.ctx.storage.deleteAll()
    this.initStorage()
    this.doc?.destroy()
    this.doc = null
    this.awareness = null
    this.documentId = null
  }

  // --- WebSocket (hibernation API) ---

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }

    const doc = await this.ready()
    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ awarenessClients: [] } satisfies SocketAttachment)

    // An editor may only sync a document written in the schema it knows:
    // older editors would drop what they don't understand.
    const editorVersion = Number(new URL(request.url).searchParams.get(SCHEMA_VERSION_PARAM) ?? 0)
    const documentVersion = readSchemaVersion(doc)
    if (editorVersion > SCHEMA_VERSION || documentVersion > SCHEMA_VERSION) {
      server.close(CLOSE_TRY_LATER, 'Lemma is updating; try again shortly')
      return new Response(null, { status: 101, webSocket: client })
    }
    if (editorVersion < documentVersion) {
      server.close(CLOSE_OUTDATED_EDITOR, 'Lemma was updated; reload to keep editing')
      return new Response(null, { status: 101, webSocket: client })
    }

    const step1 = encoding.createEncoder()
    encoding.writeVarUint(step1, MESSAGE_SYNC)
    syncProtocol.writeSyncStep1(step1, doc)
    server.send(encoding.toUint8Array(step1))

    const awareness = this.getAwareness(doc)
    const states = [...awareness.getStates().keys()]
    if (states.length > 0) {
      server.send(this.awarenessMessage(awarenessProtocol.encodeAwarenessUpdate(awareness, states)))
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message === 'string') {
      if (message === 'ping') ws.send('pong')
      return
    }

    const doc = await this.ready()
    const decoder = decoding.createDecoder(new Uint8Array(message))
    const type = decoding.readVarUint(decoder)

    switch (type) {
      case MESSAGE_SYNC: {
        const reply = encoding.createEncoder()
        encoding.writeVarUint(reply, MESSAGE_SYNC)
        // Applies step 2 / updates with the socket as origin (see onUpdate),
        // which writes them to storage synchronously.
        const syncType = syncProtocol.readSyncMessage(decoder, reply, doc, ws)
        if (encoding.length(reply) > 1) ws.send(encoding.toUint8Array(reply))
        // Confirm to the sender. Output gates hold this until the write above
        // is durable, so "saved" on the client means saved here.
        if (syncType === SYNC_STEP_2 || syncType === SYNC_UPDATE) ws.send(SAVED)
        break
      }
      case MESSAGE_AWARENESS: {
        const update = decoding.readVarUint8Array(decoder)
        awarenessProtocol.applyAwarenessUpdate(this.getAwareness(doc), update, ws)
        break
      }
      case MESSAGE_QUERY_AWARENESS: {
        const awareness = this.getAwareness(doc)
        ws.send(
          this.awarenessMessage(
            awarenessProtocol.encodeAwarenessUpdate(awareness, [...awareness.getStates().keys()])
          )
        )
        break
      }
      default:
        break
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.dropPresence(ws)
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.dropPresence(ws)
  }

  override async alarm(): Promise<void> {
    const now = Date.now()
    const lastChange = Number(this.getMeta('lastChangeAt') ?? 0)
    const dirtySince = this.getMeta('dirtySince')
    if (dirtySince !== null) {
      const firstDirty = Number(dirtySince)
      // Still typing: wait for a pause, but never longer than the max delay.
      if (now - lastChange < FLUSH_IDLE_MS && now - firstDirty < FLUSH_MAX_DELAY_MS) {
        await this.scheduleAlarm(
          Math.min(lastChange + FLUSH_IDLE_MS, firstDirty + FLUSH_MAX_DELAY_MS)
        )
      } else {
        await this.flush({ touch: true, forceSearch: false })
      }
    }

    // End of a writing session: keep a revision of where it ended.
    const revisionDue = this.getMeta('revisionDueAt')
    if (revisionDue !== null) {
      const due = Math.max(Number(revisionDue), lastChange + REVISION_SESSION_IDLE_MS)
      if (now >= due) {
        this.deleteMeta('revisionDueAt')
        await this.captureRevision(await this.ready(), 'auto')
      } else {
        await this.scheduleAlarm(due)
      }
    }
  }

  // --- loading & persistence ---

  private ready(): Promise<Y.Doc> {
    if (this.doc) return Promise.resolve(this.doc)
    if (!this.loading) {
      this.loading = this.load().finally(() => {
        this.loading = null
      })
    }
    return this.loading
  }

  private async load(): Promise<Y.Doc> {
    const sql = this.ctx.storage.sql
    const doc = new Y.Doc()

    const parts = sql
      .exec<{ data: ArrayBuffer }>('SELECT data FROM snapshot ORDER BY part')
      .toArray()
    const updates = sql
      .exec<{ data: ArrayBuffer }>('SELECT data FROM updates ORDER BY id')
      .toArray()

    if (parts.length === 0 && updates.length === 0 && !this.getMeta('seeded')) {
      await this.seed(doc)
    } else {
      doc.transact(() => {
        if (parts.length > 0)
          Y.applyUpdate(doc, concat(parts.map((row) => new Uint8Array(row.data))))
        for (const row of updates) Y.applyUpdate(doc, new Uint8Array(row.data))
      }, ORIGIN_SERVER)
      this.updateCount = updates.length
      this.updateBytes = updates.reduce((sum, row) => sum + row.data.byteLength, 0)
      if (!this.getMeta('archived')) await this.archiveLegacyBody()
    }

    doc.on('afterTransaction', (transaction: Y.Transaction) => this.checkLargeDelete(transaction))
    doc.on('update', (update: Uint8Array, origin: unknown) => this.onUpdate(doc, update, origin))

    // Bring older documents up to the current schema before anyone syncs.
    const version = readSchemaVersion(doc)
    if (version < SCHEMA_VERSION) {
      if (version > 0 || doc.getXmlFragment(BODY_FIELD).length > 0) {
        this.storeRevision(Y.encodeStateAsUpdate(doc), readFields(doc), 'before-migration')
      }
      this.capturingExplicitly = true
      try {
        migrateYDoc(doc, ORIGIN_SERVER)
      } finally {
        this.capturingExplicitly = false
      }
    }

    this.doc = doc
    return doc
  }

  /** First load: build the Yjs doc from the D1 row (legacy JSON or Markdown). */
  private async seed(doc: Y.Doc): Promise<void> {
    if (!this.documentId) throw new Error('DocumentRoom used before ensure()')
    const { db } = createDb(this.env.DB)
    const row = await db.query.documents.findFirst({
      where: (table, { eq: eqOp }) => eqOp(table.id, this.documentId as string),
      columns: { title: true, subtitle: true, content: true, markdown: true },
    })
    if (!row) throw new Error(`Document ${this.documentId} not found`)

    let content: JSONContent | undefined
    if (row.content) content = row.content as JSONContent
    else if (row.markdown?.trim()) content = markdownToContent(row.markdown)

    const seeded = createYDoc({ title: row.title ?? '', subtitle: row.subtitle ?? '', content })
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(seeded), ORIGIN_SERVER)
    seeded.destroy()

    this.ctx.storage.transactionSync(() => {
      this.writeSnapshot(doc)
      this.setMeta('seeded', String(Date.now()))
    })

    await this.archiveLegacyBody()
    // Re-render the published page and search index with the current renderer.
    this.flushing = this.flushing.then(() =>
      this.persist(doc, { touch: false, reindexSearch: true }).catch((error) =>
        console.error('DocumentRoom: post-seed flush failed', {
          documentId: this.documentId,
          error: String(error),
        })
      )
    )
  }

  /**
   * Move the pre-room body columns out of the hot `documents` row (into
   * document_legacy_bodies, so it's reversible) and mark the row as room-backed.
   * Idempotent; retried on load until it succeeds.
   */
  private async archiveLegacyBody(): Promise<void> {
    if (!this.documentId) return
    const id = this.documentId
    try {
      const { db } = createDb(this.env.DB)
      const legacy = await db.query.documents.findFirst({
        where: (table, { eq: eqOp }) => eqOp(table.id, id),
        columns: { content: true, markdown: true, html: true, bodyStore: true },
      })
      if (!legacy) return
      if (legacy.bodyStore !== 'room') {
        // Back up first; clearing only happens once the copy exists.
        if (legacy.content || legacy.markdown || legacy.html) {
          await db
            .insert(documentLegacyBodies)
            .values({
              documentId: id,
              content: legacy.content ? JSON.stringify(legacy.content) : null,
              markdown: legacy.markdown,
              html: legacy.html,
            })
            .onConflictDoNothing()
        }
        await db
          .update(documents)
          .set({ content: null, markdown: '', html: null, bodyStore: 'room' })
          .where(and(eq(documents.id, id), isNull(documents.bodyStore)))
      }
      this.setMeta('archived', String(Date.now()))
    } catch (error) {
      console.error('DocumentRoom: archiving legacy body failed', {
        documentId: id,
        error: String(error),
      })
    }
  }

  private onUpdate(doc: Y.Doc, update: Uint8Array, origin: unknown): void {
    // 0. An edit that deleted a lot: storage still holds the state before it.
    if (this.largeDelete) {
      this.largeDelete = false
      this.captureStoredState('before-large-edit')
    }

    // 1. Durable first. Output gates hold every message below until this write
    //    is committed, so nobody hears "saved" for something that isn't.
    const sql = this.ctx.storage.sql
    if (update.byteLength >= LARGE_UPDATE_BYTES) {
      this.compact(doc)
    } else {
      sql.exec('INSERT INTO updates (data) VALUES (?)', update)
      this.updateCount += 1
      this.updateBytes += update.byteLength
      if (this.updateCount >= COMPACT_AFTER_UPDATES || this.updateBytes >= COMPACT_AFTER_BYTES) {
        this.compact(doc)
      }
    }

    // 2. Fan out to the other editors.
    const message = encoding.createEncoder()
    encoding.writeVarUint(message, MESSAGE_SYNC)
    syncProtocol.writeUpdate(message, update)
    const bytes = encoding.toUint8Array(message)
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === origin) continue
      try {
        ws.send(bytes)
      } catch {
        // closed socket; hibernation cleanup reaps it
      }
    }

    // 3. Refresh the D1 read model once edits pause.
    this.scheduleFlush()
  }

  private compact(doc: Y.Doc): void {
    this.ctx.storage.transactionSync(() => {
      this.writeSnapshot(doc)
      this.ctx.storage.sql.exec('DELETE FROM updates')
    })
    this.updateCount = 0
    this.updateBytes = 0
  }

  private writeSnapshot(doc: Y.Doc): void {
    const sql = this.ctx.storage.sql
    const state = Y.encodeStateAsUpdate(doc)
    sql.exec('DELETE FROM snapshot')
    for (
      let offset = 0, part = 0;
      offset < state.byteLength;
      offset += SNAPSHOT_PART_BYTES, part++
    ) {
      sql.exec(
        'INSERT INTO snapshot (part, data) VALUES (?, ?)',
        part,
        state.subarray(offset, offset + SNAPSHOT_PART_BYTES)
      )
    }
  }

  private scheduleFlush(): void {
    const now = Date.now()
    this.setMeta('lastChangeAt', String(now))
    if (this.dirtySince === null) {
      this.dirtySince = Number(this.getMeta('dirtySince') ?? now)
      this.setMeta('dirtySince', String(this.dirtySince))
      void this.scheduleAlarm(now + FLUSH_IDLE_MS)
    }
  }

  /** The object has one alarm; keep the earliest time anything needs it. */
  private async scheduleAlarm(at: number): Promise<void> {
    const current = await this.ctx.storage.getAlarm()
    if (current === null || at < current || current < Date.now()) {
      await this.ctx.storage.setAlarm(at)
    }
  }

  private flush(options: { touch: boolean; forceSearch: boolean; force?: boolean }): Promise<void> {
    const run = async () => {
      const doc = await this.ready()
      const lastSearch = Number(this.getMeta('lastSearchAt') ?? 0)
      // Short documents (notes, most posts) are searchable within seconds;
      // re-indexing a long one is the costly part of a flush, so it waits.
      const searchInterval =
        Number(this.getMeta('words') ?? 0) < SHORT_DOCUMENT_WORDS
          ? SHORT_SEARCH_INTERVAL_MS
          : SEARCH_MIN_INTERVAL_MS
      const reindexSearch = options.forceSearch || Date.now() - lastSearch >= searchInterval

      // Clear the dirty markers first: edits that land during the D1 writes
      // below schedule a fresh flush instead of being swallowed by this one.
      this.dirtySince = null
      this.ctx.storage.sql.exec("DELETE FROM meta WHERE key = 'dirtySince'")

      await rehostImages(doc, this.env, this.documentId)
      const fields = await this.persist(doc, {
        touch: options.touch,
        reindexSearch,
        force: options.force,
      })

      if (!reindexSearch) {
        // Search lags typing by at most SEARCH_MIN_INTERVAL_MS.
        this.setMeta('searchDirty', '1')
        await this.scheduleAlarm(lastSearch + searchInterval)
        this.setMeta('dirtySince', String(Date.now()))
      }

      if (fields && options.touch) await this.afterEdits(doc, fields)
      await this.compressRevisions()
    }
    const next = this.flushing.then(run, run)
    this.flushing = next.catch(() => {})
    return next
  }

  /** Returns the fields it read, or null if nothing changed / no document. */
  private async persist(
    doc: Y.Doc,
    options: { touch: boolean; reindexSearch: boolean; force?: boolean }
  ): Promise<DocumentFields | null> {
    if (!this.documentId) return null
    const fields = readFields(doc)
    // Skip the D1 writes (and the "last edited" bump) when nothing changed
    // since the last flush, e.g. an alarm firing after an API edit already
    // flushed, or a re-render request for an unchanged document.
    const citationStyle = doc.getMap(META_FIELD).get('citationStyle')
    // A new citation style changes the rendered page, not the fields.
    const fingerprint = `${fingerprintOf(fields)}:${String(citationStyle ?? '')}`
    const unchanged = fingerprint === this.getMeta('flushedFingerprint')
    if (unchanged && !options.force && !(options.reindexSearch && this.getMeta('searchDirty')))
      return null
    const { db } = createDb(this.env.DB)
    const updated = await persistDerived(db, this.documentId, fields, {
      ...options,
      touch: options.touch && !unchanged,
      citationStyle,
    })
    if (updated) this.setMeta('words', String(Number(updated.wordCount) || 0))
    this.setMeta('flushedFingerprint', fingerprint)
    if (!updated) {
      // The D1 row is gone: the document was deleted out from under us.
      await this.destroy()
      return null
    }
    if (options.reindexSearch) {
      this.setMeta('lastSearchAt', String(Date.now()))
      this.ctx.storage.sql.exec("DELETE FROM meta WHERE key = 'searchDirty'")
    }
    return unchanged ? null : fields
  }

  // --- revision history ---

  /**
   * After edits were flushed: keep a revision every REVISION_INTERVAL_MS of
   * writing, and make sure one is kept when this session ends.
   */
  private async afterEdits(doc: Y.Doc, fields: DocumentFields): Promise<void> {
    if (fingerprintOf(fields) === this.getMeta('lastRevisionFingerprint')) return
    const lastRevision = Number(this.getMeta('lastRevisionAt') ?? 0)
    if (Date.now() - lastRevision >= REVISION_INTERVAL_MS) {
      await this.captureRevision(doc, 'auto', { fields })
      return
    }
    const lastChange = Number(this.getMeta('lastChangeAt') ?? Date.now())
    this.setMeta('revisionDueAt', String(lastChange + REVISION_SESSION_IDLE_MS))
    await this.scheduleAlarm(lastChange + REVISION_SESSION_IDLE_MS)
  }

  private checkLargeDelete(transaction: Y.Transaction): void {
    if (this.capturingExplicitly || transaction.deleteSet.clients.size === 0) return
    let deleted = 0
    Y.iterateDeletedStructs(transaction, transaction.deleteSet, (struct) => {
      if (struct instanceof Y.Item && struct.content instanceof Y.ContentString) {
        deleted += struct.length
      }
    })
    if (deleted < LARGE_DELETE_CHARS) return
    const last = Number(this.getMeta('lastLargeDeleteAt') ?? 0)
    if (Date.now() - last < LARGE_DELETE_MIN_INTERVAL_MS) return
    this.setMeta('lastLargeDeleteAt', String(Date.now()))
    this.largeDelete = true
  }

  /** Keep the stored state (snapshot + update log), i.e. as of the last update. */
  private captureStoredState(reason: RevisionReason): void {
    const sql = this.ctx.storage.sql
    const before = new Y.Doc()
    const parts = sql
      .exec<{ data: ArrayBuffer }>('SELECT data FROM snapshot ORDER BY part')
      .toArray()
    if (parts.length > 0)
      Y.applyUpdate(before, concat(parts.map((row) => new Uint8Array(row.data))))
    for (const row of sql.exec<{ data: ArrayBuffer }>('SELECT data FROM updates ORDER BY id')) {
      Y.applyUpdate(before, new Uint8Array(row.data))
    }
    this.storeRevision(Y.encodeStateAsUpdate(before), readFields(before), reason)
    before.destroy()
  }

  private async captureRevision(
    doc: Y.Doc,
    reason: RevisionReason,
    options: { fields?: DocumentFields; force?: boolean } = {}
  ): Promise<void> {
    const fields = options.fields ?? readFields(doc)
    if (!options.force && reason === 'auto') {
      if (fingerprintOf(fields) === this.getMeta('lastRevisionFingerprint')) return
    }
    this.storeRevision(Y.encodeStateAsUpdate(doc), fields, reason)
    await this.compressRevisions()
  }

  /** Synchronous, so it can run before an update is applied; compressed later. */
  private storeRevision(state: Uint8Array, fields: DocumentFields, reason: RevisionReason): void {
    const sql = this.ctx.storage.sql
    const now = Date.now()
    const fingerprint = fingerprintOf(fields)
    this.ctx.storage.transactionSync(() => {
      const { id } = sql
        .exec<{ id: number }>(
          `INSERT INTO revisions (created_at, reason, words, title, fingerprint, encoding, bytes)
           VALUES (?, ?, ?, ?, ?, 'yjs', ?) RETURNING id`,
          now,
          reason,
          countWords(extractText(fields.content)),
          fields.title,
          fingerprint,
          state.byteLength
        )
        .one()
      writeParts(sql, id, state)
      this.setMeta('lastRevisionAt', String(now))
      this.setMeta('lastRevisionFingerprint', fingerprint)
      this.pruneRevisions(now)
    })
  }

  private pruneRevisions(now: number): void {
    const sql = this.ctx.storage.sql
    const revisions = sql
      .exec<{ id: number; createdAt: number; reason: RevisionReason }>(
        'SELECT id, created_at AS createdAt, reason FROM revisions'
      )
      .toArray()
    for (const id of revisionsToPrune(revisions, now)) {
      sql.exec('DELETE FROM revision_parts WHERE revision_id = ?', id)
      sql.exec('DELETE FROM revisions WHERE id = ?', id)
    }
  }

  private async compressRevisions(): Promise<void> {
    const sql = this.ctx.storage.sql
    const pending = sql
      .exec<{ id: number }>("SELECT id FROM revisions WHERE encoding = 'yjs'")
      .toArray()
    for (const { id } of pending) {
      const raw = readParts(sql, id)
      const compressed = await gzip(raw)
      this.ctx.storage.transactionSync(() => {
        // Pruned while compressing: nothing to update.
        const exists = sql.exec('SELECT 1 FROM revisions WHERE id = ?', id).toArray().length > 0
        if (!exists) return
        sql.exec('DELETE FROM revision_parts WHERE revision_id = ?', id)
        writeParts(sql, id, compressed)
        sql.exec(
          "UPDATE revisions SET encoding = 'yjs.gz', bytes = ? WHERE id = ?",
          compressed.byteLength,
          id
        )
      })
    }
  }

  /** A revision as a Yjs doc, migrated to the current schema. */
  private async loadRevision(id: number): Promise<Y.Doc | null> {
    const sql = this.ctx.storage.sql
    const row = sql
      .exec<{ encoding: string }>('SELECT encoding FROM revisions WHERE id = ?', id)
      .toArray()[0]
    if (!row) return null
    const stored = readParts(sql, id)
    const state = row.encoding === 'yjs.gz' ? await gunzip(stored) : stored
    const revision = new Y.Doc()
    Y.applyUpdate(revision, state)
    migrateYDoc(revision)
    return revision
  }

  // --- helpers ---

  private getAwareness(doc: Y.Doc): awarenessProtocol.Awareness {
    if (this.awareness) return this.awareness
    const awareness = new awarenessProtocol.Awareness(doc)
    awareness.setLocalState(null)
    awareness.on(
      'update',
      (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown
      ) => {
        if (origin && typeof origin === 'object' && 'serializeAttachment' in origin) {
          const ws = origin as WebSocket
          const attachment = (ws.deserializeAttachment() as SocketAttachment | null) ?? {
            awarenessClients: [],
          }
          const clients = new Set(attachment.awarenessClients)
          for (const id of [...added, ...updated]) clients.add(id)
          for (const id of removed) clients.delete(id)
          ws.serializeAttachment({ awarenessClients: [...clients] } satisfies SocketAttachment)
        }
        const changed = [...added, ...updated, ...removed]
        const message = this.awarenessMessage(
          awarenessProtocol.encodeAwarenessUpdate(awareness, changed)
        )
        for (const ws of this.ctx.getWebSockets()) {
          try {
            ws.send(message)
          } catch {
            // ignore
          }
        }
      }
    )
    this.awareness = awareness
    return awareness
  }

  private dropPresence(ws: WebSocket): void {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null
    if (!attachment?.awarenessClients.length || !this.awareness) return
    awarenessProtocol.removeAwarenessStates(this.awareness, attachment.awarenessClients, null)
  }

  private awarenessMessage(update: Uint8Array): Uint8Array {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
    encoding.writeVarUint8Array(encoder, update)
    return encoding.toUint8Array(encoder)
  }

  private getMeta(key: string): string | null {
    const row = this.ctx.storage.sql
      .exec<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)
      .toArray()[0]
    return row?.value ?? null
  }

  private deleteMeta(key: string): void {
    this.ctx.storage.sql.exec('DELETE FROM meta WHERE key = ?', key)
  }

  private setMeta(key: string, value: string): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value
    )
  }
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

const REVISION_PART_BYTES = 1024 * 1024

function writeParts(sql: SqlStorage, revisionId: number, data: Uint8Array): void {
  for (let offset = 0, part = 0; offset < data.byteLength; offset += REVISION_PART_BYTES, part++) {
    sql.exec(
      'INSERT INTO revision_parts (revision_id, part, data) VALUES (?, ?, ?)',
      revisionId,
      part,
      data.subarray(offset, offset + REVISION_PART_BYTES)
    )
  }
}

function readParts(sql: SqlStorage, revisionId: number): Uint8Array {
  return concat(
    sql
      .exec<{ data: ArrayBuffer }>(
        'SELECT data FROM revision_parts WHERE revision_id = ? ORDER BY part',
        revisionId
      )
      .toArray()
      .map((row) => new Uint8Array(row.data))
  )
}

async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(data)])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(data)])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// FNV-1a over the fields' JSON: cheap enough to run on every flush.
/** Every text run a writer can see: title, subtitle and the body's paragraphs. */
function textRuns(doc: Y.Doc): (Y.Text | Y.XmlText)[] {
  const runs: (Y.Text | Y.XmlText)[] = [doc.getText(TITLE_FIELD), doc.getText(SUBTITLE_FIELD)]
  const walk = (node: Y.XmlElement | Y.XmlFragment) => {
    for (const child of node.toArray()) {
      if (child instanceof Y.XmlText) runs.push(child)
      else if (child instanceof Y.XmlElement) {
        // Code is code; a find & replace across prose shouldn't rewrite it.
        if (child.nodeName !== 'codeBlock') walk(child)
      }
    }
  }
  walk(doc.getXmlFragment(BODY_FIELD))
  return runs
}

/** A run's text with each embed as one placeholder character, so offsets line up. */
function plainOf(run: Y.Text | Y.XmlText, delta = run.toDelta() as { insert: unknown }[]): string {
  return delta.map((part) => (typeof part.insert === 'string' ? part.insert : '\ufffc')).join('')
}

function attributesAt(
  delta: { insert: unknown; attributes?: Record<string, unknown> }[],
  index: number
): Record<string, unknown> | undefined {
  let offset = 0
  for (const part of delta) {
    const length = typeof part.insert === 'string' ? part.insert.length : 1
    if (index < offset + length) return part.attributes
    offset += length
  }
  return undefined
}

function fingerprintOf(fields: DocumentFields): string {
  const text = JSON.stringify(fields)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${(hash >>> 0).toString(16)}:${text.length}`
}
