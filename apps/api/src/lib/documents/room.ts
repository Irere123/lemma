import { markdownToContent } from '@lemma/content/markdown'
import type { JSONContent } from '@lemma/content/schema'
import { validateContent } from '@lemma/content/schema'
import type { DocumentFields } from '@lemma/content/yjs'

import { getRuntimeBindings } from '@api/env-runtime'
import type { RevisionSummary } from './revisions'

export { ContentValidationError } from '@lemma/content/schema'

// The RPC surface of DocumentRoom. Spelled out because Workers' generated stub
// types recurse forever on the (recursive) JSONContent type.
export type DocumentRoomStub = {
  ensure(documentId: string): Promise<void>
  read(): Promise<DocumentFields>
  applyEdit(fields: Partial<DocumentFields>): Promise<void>
  flushNow(options?: { revision?: 'publish' }): Promise<void>
  destroy(): Promise<void>
  listRevisions(): Promise<RevisionSummary[]>
  getRevision(id: number): Promise<(RevisionSummary & { fields: DocumentFields }) | null>
  restoreRevision(id: number): Promise<boolean>
}

/** The document's DocumentRoom stub, told its own id. */
export async function openRoom(documentId: string): Promise<DocumentRoomStub> {
  const namespace = getRuntimeBindings().DOCUMENT_ROOM
  if (!namespace) throw new Error('DOCUMENT_ROOM binding is not configured')
  const stub = namespace.getByName(documentId) as unknown as DocumentRoomStub
  await stub.ensure(documentId)
  return stub
}

export type BodyInput = {
  title?: string | null
  subtitle?: string | null
  content?: unknown
  markdown?: string | null
}

/**
 * Turn API input into validated room fields. `content` (Tiptap JSON) wins over
 * `markdown`; either is checked against the schema and rejected with a
 * ContentValidationError if it doesn't fit.
 */
export function bodyFields(input: BodyInput): Partial<DocumentFields> {
  const fields: Partial<DocumentFields> = {}
  if (Object.hasOwn(input, 'title')) fields.title = input.title ?? ''
  if (Object.hasOwn(input, 'subtitle')) fields.subtitle = input.subtitle ?? ''

  if (input.content !== undefined && input.content !== null) {
    const raw = typeof input.content === 'string' ? JSON.parse(input.content) : input.content
    fields.content = validateContent(raw, { strict: true })
  } else if (typeof input.markdown === 'string') {
    fields.content = validateContent(markdownToContent(input.markdown), { strict: true })
  }
  return fields
}

export const hasBodyFields = (fields: Partial<DocumentFields>) =>
  fields.title !== undefined || fields.subtitle !== undefined || fields.content !== undefined

/** Current body JSON (seeds the room from legacy columns on first use). */
export async function readDocumentContent(documentId: string): Promise<JSONContent> {
  const room = await openRoom(documentId)
  const fields = await room.read()
  return fields.content
}
