import { documentLinks, summarize } from '@lemma/content'
import type { DocumentFields } from '@lemma/content/yjs'
import { and, eq, inArray } from 'drizzle-orm'

import type { DB } from '@api/db'
import { documentMetaColumns, ensureUniqueSlug } from '@api/db/queries/documents'
import { documentLinks as documentLinksTable, documentReferences, documents } from '@api/db/schema'
import { slugifyString } from '@api/db/utils/slugify'
import { generateId } from '@api/lib/utils'
import { writePublishedHtml, writeSearchIndex } from './derived'
import { renderPublishedHtml } from './render'
import { citationStyleOf, citationsFor, documentLinkResolver } from './render-context'

export type PersistOptions = {
  /** Bump updatedAt (a real edit), as opposed to a re-index after seeding. */
  touch: boolean
  /** Rebuild the search index too (rate-limited by the room; it's the costly part). */
  reindexSearch: boolean
  /** The document's citation style (its room's meta). */
  citationStyle?: unknown
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

  const citations = await citationsFor(
    db,
    row.userId ?? '',
    fields.content,
    citationStyleOf(options.citationStyle)
  )
  await writeLinkTables(db, documentId, row.userId ?? '', fields, citations.referenceIds)

  await writePublishedHtml(
    db,
    documentId,
    row.status === 'PUBLISHED'
      ? renderPublishedHtml(fields.content, {
          citations: citations.rendered,
          documentLink: await documentLinkResolver(db, row.userId ?? '', fields.content),
        })
      : null
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

/**
 * Rebuild the document's rows in document_links (its links to other
 * documents of the same writer, for backlinks) and document_references (the
 * references it cites, so editing one re-renders it).
 */
async function writeLinkTables(
  db: DB,
  documentId: string,
  userId: string,
  fields: DocumentFields,
  referenceIds: string[]
) {
  const links = documentLinks(fields.content).filter((link) => link.documentId !== documentId)
  const targets = [...new Set(links.map((link) => link.documentId))]
  const existing =
    targets.length > 0
      ? new Set(
          (
            await db
              .select({ id: documents.id })
              .from(documents)
              .where(and(eq(documents.userId, userId), inArray(documents.id, targets)))
          ).map((target) => target.id)
        )
      : new Set<string>()
  const statements = [
    db.delete(documentLinksTable).where(eq(documentLinksTable.sourceId, documentId)),
    db.delete(documentReferences).where(eq(documentReferences.documentId, documentId)),
    ...links
      .filter((link) => existing.has(link.documentId))
      .map((link, position) =>
        db.insert(documentLinksTable).values({
          sourceId: documentId,
          targetId: link.documentId,
          blockId: link.blockId,
          context: link.context,
          position,
        })
      ),
    ...referenceIds.map((referenceId) =>
      db.insert(documentReferences).values({ documentId, referenceId }).onConflictDoNothing()
    ),
  ]
  await db.batch(statements as [(typeof statements)[number], ...typeof statements])
}
