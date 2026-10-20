import { summarize } from '@lemma/content'
import type { DocumentFields } from '@lemma/content/yjs'
import { eq } from 'drizzle-orm'

import type { DB } from '@api/db'
import { documentMetaColumns, ensureUniqueSlug } from '@api/db/queries/documents'
import { documents } from '@api/db/schema'
import { slugifyString } from '@api/db/utils/slugify'
import { generateId } from '@api/lib/utils'
import { writePublishedHtml, writeSearchIndex } from './derived'
import { renderPublishedHtml } from './render'

export type PersistOptions = {
  /** Bump updatedAt (a real edit), as opposed to a re-index after seeding. */
  touch: boolean
  /** Rebuild the search index too (rate-limited by the room; it's the costly part). */
  reindexSearch: boolean
}

/**
 * Mirror a room's current fields into D1: metadata columns, published HTML
 * and the search index. The room is the source of truth; this is the read
 * model everything else (lists, reader, feeds, search) uses.
 */
export async function persistDerived(
  db: DB,
  documentId: string,
  fields: DocumentFields,
  options: PersistOptions
) {
  const row = await db.query.documents.findFirst({
    where: (table, { eq: eqOp }) => eqOp(table.id, documentId),
    columns: {
      id: true,
      userId: true,
      title: true,
      status: true,
      slug: true,
      contentVersion: true,
      firstPublishedAt: true,
    },
  })
  if (!row) return null

  const summary = summarize(fields.content)
  const title = fields.title.trim() || null
  const subtitle = fields.subtitle.trim() || null

  const values: Partial<typeof documents.$inferInsert> = {
    title,
    subtitle,
    excerpt: summary.excerpt,
    wordCount: String(summary.words),
    readingTime: summary.words > 0 ? summary.readingTime : '',
    contentVersion: (row.contentVersion ?? 1) + 1,
  }
  if (options.touch) values.updatedAt = new Date()

  // Links to a post must survive title edits once it has been published.
  if (!row.firstPublishedAt && (title !== row.title || !row.slug)) {
    values.slug = await ensureUniqueSlug(db, slugifyString(title ?? '') || generateId(), documentId)
  }

  const [updated] = await db
    .update(documents)
    .set(values)
    .where(eq(documents.id, documentId))
    .returning(documentMetaColumns)

  await writePublishedHtml(
    db,
    documentId,
    row.status === 'PUBLISHED' ? renderPublishedHtml(fields.content) : null
  )

  if (options.reindexSearch) {
    await writeSearchIndex(db, {
      documentId,
      userId: row.userId,
      title: title ?? '',
      subtitle: subtitle ?? '',
      text: summary.text,
    })
  }

  return updated ?? null
}
