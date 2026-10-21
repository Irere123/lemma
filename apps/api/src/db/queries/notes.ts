import { and, asc, eq, ne, notInArray, sql } from 'drizzle-orm'

import type { DB } from '@api/db'
import { documentLinks, documentSearch, documents } from '@api/db/schema'
import { createDocument, type DocumentMeta, getUserDocumentById } from './documents'

export type Backlink = {
  sourceId: string
  title: string | null
  kind: string
  context: string
  blockId: string | null
}

/** Documents that link to this one, each link with the sentence around it. */
export async function getBacklinks(db: DB, targetId: string, userId: string): Promise<Backlink[]> {
  return db
    .select({
      sourceId: documentLinks.sourceId,
      title: documents.title,
      kind: documents.kind,
      context: documentLinks.context,
      blockId: documentLinks.blockId,
    })
    .from(documentLinks)
    .innerJoin(documents, eq(documents.id, documentLinks.sourceId))
    .where(and(eq(documentLinks.targetId, targetId), eq(documents.userId, userId)))
    .orderBy(asc(documents.title), asc(documentLinks.position))
}

export type Mention = { documentId: string; title: string | null; kind: string; context: string }

/**
 * Documents that mention this one's title in their text but don't link to it
 * yet ("Unlinked mentions"). Uses the search index, so it's as fresh as it is.
 */
export async function getUnlinkedMentions(
  db: DB,
  target: Pick<DocumentMeta, 'id' | 'title'>,
  userId: string
): Promise<Mention[]> {
  const title = target.title?.trim()
  if (!title || title.length < 3) return []
  const linked = (
    await db
      .select({ id: documentLinks.sourceId })
      .from(documentLinks)
      .where(eq(documentLinks.targetId, target.id))
  ).map((row) => row.id)
  // A phrase query: the title's words in order.
  const phrase = `"${title.replace(/"/g, '""')}"`
  const rows = await db
    .select({
      documentId: documentSearch.documentId,
      title: documents.title,
      kind: documents.kind,
      body: documentSearch.body,
    })
    .from(documentSearch)
    .innerJoin(documents, eq(documents.id, documentSearch.documentId))
    .where(
      and(
        eq(documentSearch.userId, userId),
        ne(documentSearch.documentId, target.id),
        linked.length > 0 ? notInArray(documentSearch.documentId, linked) : undefined,
        sql`${documentSearch.id} IN (SELECT rowid FROM document_search_fts WHERE document_search_fts MATCH ${`body:${phrase}`})`
      )
    )
    .limit(20)
  const seen = new Set<string>()
  const mentions: Mention[] = []
  const lower = title.toLowerCase()
  for (const row of rows) {
    if (seen.has(row.documentId)) continue
    seen.add(row.documentId)
    const at = row.body.toLowerCase().indexOf(lower)
    const start = Math.max(0, at - 80)
    const context =
      at === -1
        ? ''
        : `${start > 0 ? '…' : ''}${row.body.slice(start, at + lower.length + 80).trim()}${
            at + lower.length + 80 < row.body.length ? '…' : ''
          }`
    mentions.push({ documentId: row.documentId, title: row.title, kind: row.kind, context })
  }
  return mentions
}

/** Today's note (by the writer's local date), created on first use. */
export async function getOrCreateDailyNote(
  db: DB,
  userId: string,
  input: { date: string; title: string; id?: string }
): Promise<DocumentMeta | undefined> {
  const [existing] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.journalDate, input.date)))
    .limit(1)
  if (existing) return getUserDocumentById(db, existing.id, userId)
  try {
    return await createDocument(db, userId, {
      id: input.id,
      kind: 'note',
      title: input.title,
      journalDate: input.date,
    })
  } catch {
    // Two tabs asked at once: the unique (user, day) index kept one.
    const [created] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.userId, userId), eq(documents.journalDate, input.date)))
      .limit(1)
    return created ? getUserDocumentById(db, created.id, userId) : undefined
  }
}
