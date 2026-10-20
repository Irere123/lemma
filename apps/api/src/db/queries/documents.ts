import { and, desc, eq, inArray, lt, ne, or, sql } from 'drizzle-orm'

import type { DB } from '@api/db'
import { type Document, type DocumentStatus, documentLikes, documents } from '@api/db/schema'
import { slugifyString } from '@api/db/utils/slugify'
import { readPublishedHtml, writeSearchIndex } from '@api/lib/documents/derived'
import { bodyFields, hasBodyFields, openRoom } from '@api/lib/documents/room'
import { generateId } from '@api/lib/utils'
import type { UpsertDocumentData } from '@api/schemas'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

/**
 * Everything about a document except its body. The body lives in the
 * document's DocumentRoom (see realtime/document-room.ts); reads that need it
 * go through the room or the derived tables (document_html, document_search).
 */
export const documentMetaColumns = {
  id: documents.id,
  slug: documents.slug,
  title: documents.title,
  subtitle: documents.subtitle,
  status: documents.status,
  userId: documents.userId,
  excerpt: documents.excerpt,
  contentVersion: documents.contentVersion,
  bannerImage: documents.bannerImage,
  scheduledDate: documents.scheduledDate,
  publishedDate: documents.publishedDate,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
  metaTitle: documents.metaTitle,
  metaDescription: documents.metaDescription,
  metaKeywords: documents.metaKeywords,
  canonicalUrl: documents.canonicalUrl,
  ogImage: documents.ogImage,
  readingTime: documents.readingTime,
  wordCount: documents.wordCount,
  isFeatured: documents.isFeatured,
  bodyStore: documents.bodyStore,
  firstPublishedAt: documents.firstPublishedAt,
}

export type DocumentMeta = Omit<Document, 'content' | 'markdown' | 'html'>

export async function ensureUniqueSlug(db: DB, base: string, excludeId?: string): Promise<string> {
  let candidate = base || 'post'
  let suffix = 0
  while (true) {
    const whereClause = excludeId
      ? and(eq(documents.slug, candidate), ne(documents.id, excludeId))
      : eq(documents.slug, candidate)
    const existing = await db
      .select({ id: documents.id })
      .from(documents)
      .where(whereClause)
      .limit(1)
    if (existing.length === 0) return candidate
    suffix += 1
    candidate = `${base}-${suffix}`
  }
}

/**
 * Create or update a document for `userId`.
 *
 * Metadata (status, cover, dates) is written to D1 directly. Title, subtitle
 * and body go to the document's room as a merged edit, which then refreshes
 * D1. Body input is validated against the content schema; invalid input
 * throws ContentValidationError before anything is written.
 */
export const upsertDocument = async (
  db: DB,
  data: UpsertDocumentData,
  userId: string
): Promise<DocumentMeta | undefined> => {
  const fields = bodyFields(data)

  if (data.id) {
    const existing = await getUserDocumentById(db, data.id, userId)
    if (!existing) return undefined

    const updateValues: Partial<typeof documents.$inferInsert> = {}
    if (Object.hasOwn(data, 'status') && data.status) updateValues.status = data.status
    if (Object.hasOwn(data, 'bannerImage')) updateValues.bannerImage = data.bannerImage ?? null
    if (Object.hasOwn(data, 'scheduledDate'))
      updateValues.scheduledDate = data.scheduledDate ?? null
    if (Object.hasOwn(data, 'publishedDate'))
      updateValues.publishedDate = data.publishedDate ?? null
    if (updateValues.status === 'PUBLISHED' && !existing.firstPublishedAt) {
      updateValues.firstPublishedAt = new Date()
    }

    const statusChanged =
      updateValues.status !== undefined && updateValues.status !== existing.status
    if (Object.keys(updateValues).length > 0) {
      updateValues.updatedAt = new Date()
      await db
        .update(documents)
        .set(updateValues)
        .where(and(eq(documents.id, data.id), eq(documents.userId, userId)))
    }

    const room = hasBodyFields(fields) || statusChanged ? await openRoom(data.id) : null
    // applyEdit and flushNow both re-render the published HTML for the new status.
    if (room && hasBodyFields(fields)) await room.applyEdit(fields)
    const published = statusChanged && updateValues.status === 'PUBLISHED'
    // Keep each published version in the document's history.
    if (room && (published || !hasBodyFields(fields))) {
      await room.flushNow(published ? { revision: 'publish' } : {})
    }

    return getUserDocumentById(db, data.id, userId)
  }

  const now = new Date()
  const title = fields.title?.trim() || null
  const id = generateId()
  const slug = await ensureUniqueSlug(db, slugifyString(title ?? '') || generateId())
  const status = data.status ?? 'DRAFT'

  await db.insert(documents).values({
    id,
    slug,
    userId,
    title,
    subtitle: fields.subtitle?.trim() || null,
    status,
    markdown: '',
    bodyStore: 'room',
    bannerImage: data.bannerImage ?? null,
    scheduledDate: data.scheduledDate ?? null,
    publishedDate: data.publishedDate ?? null,
    firstPublishedAt: status === 'PUBLISHED' ? now : null,
    wordCount: '0',
    createdAt: now,
    updatedAt: now,
  })

  if (fields.content !== undefined || status === 'PUBLISHED') {
    const room = await openRoom(id)
    if (fields.content !== undefined) await room.applyEdit({ content: fields.content })
    else await room.flushNow()
  } else {
    // Searchable by title straight away; the room re-indexes on first edit.
    await writeSearchIndex(db, {
      documentId: id,
      userId,
      title: title ?? '',
      subtitle: fields.subtitle ?? '',
      text: '',
    })
  }

  return getUserDocumentById(db, id, userId)
}

export const deleteDocument = async (
  db: DB,
  documentId: string,
  userId: string
): Promise<boolean> => {
  const result = await db
    .delete(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .returning({ id: documents.id })
  if (result.length === 0) return false
  try {
    await (await openRoom(documentId)).destroy()
  } catch (error) {
    console.error('deleteDocument: failed to destroy room', { documentId, error: String(error) })
  }
  return true
}

export const getDueScheduledDocuments = async (
  db: DB,
  now: Date = new Date(),
  limit = 50
): Promise<DocumentMeta[]> => {
  return db
    .select(documentMetaColumns)
    .from(documents)
    .where(and(eq(documents.status, 'DRAFT'), lt(documents.scheduledDate, now)))
    .orderBy(documents.scheduledDate)
    .limit(limit)
}

type UserDocumentsData = {
  userId: string
  status?: DocumentStatus
  limit?: number
  cursor?: string
}

export const getUserDocuments = async (db: DB, data: UserDocumentsData) => {
  const limit = Math.min(data.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

  const filters = [eq(documents.userId, data.userId)]

  if (data.status) {
    filters.push(eq(documents.status, data.status))
  }

  // Add cursor-based pagination
  if (data.cursor) {
    filters.push(lt(documents.createdAt, new Date(data.cursor)))
  }

  const userDocuments = await db
    .select(documentMetaColumns)
    .from(documents)
    .where(and(...filters))
    .orderBy(desc(documents.publishedDate))
    .limit(limit + 1) // Fetch one extra to determine if there's a next page

  return userDocuments
}

// Internal lookup (no ownership check) — never expose directly to clients.
export const getDocumentById = async (db: DB, id: string): Promise<DocumentMeta | undefined> => {
  const [row] = await db
    .select(documentMetaColumns)
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1)
  return row
}

/**
 * Batch-load documents by id (avoids the GraphQL N+1 when resolving
 * `Campaign.document` across a list of campaigns).
 */
export const getDocumentsByIds = async (
  db: DB,
  ids: string[]
): Promise<Map<string, DocumentMeta>> => {
  if (ids.length === 0) return new Map()

  const rows = await db
    .select(documentMetaColumns)
    .from(documents)
    .where(inArray(documents.id, ids))

  return new Map(rows.map((doc) => [doc.id, doc]))
}

// User-scoped fetch: only returns the document if it belongs to the caller.
export const getUserDocumentById = async (
  db: DB,
  id: string,
  userId: string
): Promise<DocumentMeta | undefined> => {
  const [row] = await db
    .select(documentMetaColumns)
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1)
  return row
}

export const updateDocumentBannerImage = async (
  db: DB,
  id: string,
  userId: string,
  bannerImage: string | null
) => {
  const [document] = await db
    .update(documents)
    .set({ bannerImage, updatedAt: new Date() })
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .returning(documentMetaColumns)

  return document
}

type PublishedArticlesOptions = {
  limit?: number
  // Optionally scope the listing to a single writer (e.g. per-writer feeds).
  writerId?: string
  // 'latest' (default) orders by publish date; 'popular' by like count.
  sort?: 'latest' | 'popular'
}

// List rows omit the body and internal bookkeeping columns.
export type PublishedArticle = Omit<
  DocumentMeta,
  'contentVersion' | 'bodyStore' | 'firstPublishedAt'
> & { likeCount: number }

export const getPublishedArticles = async (
  db: DB,
  options: PublishedArticlesOptions = {}
): Promise<PublishedArticle[]> => {
  const safeLimit = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

  const filters = [eq(documents.status, 'PUBLISHED')]
  if (options.writerId) {
    filters.push(eq(documents.userId, options.writerId))
  }

  const likeCount = sql<number>`count(${documentLikes.id})`.as('like_count')
  const orderBy =
    options.sort === 'popular'
      ? [desc(likeCount), desc(documents.publishedDate)]
      : [desc(documents.publishedDate)]

  const publishedArticles = await db
    .select({
      id: documents.id,
      slug: documents.slug,
      title: documents.title,
      subtitle: documents.subtitle,
      status: documents.status,
      userId: documents.userId,
      bannerImage: documents.bannerImage,
      scheduledDate: documents.scheduledDate,
      publishedDate: documents.publishedDate,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      metaTitle: documents.metaTitle,
      metaDescription: documents.metaDescription,
      metaKeywords: documents.metaKeywords,
      canonicalUrl: documents.canonicalUrl,
      ogImage: documents.ogImage,
      readingTime: documents.readingTime,
      wordCount: documents.wordCount,
      excerpt: documents.excerpt,
      isFeatured: documents.isFeatured,
      likeCount,
    })
    .from(documents)
    .leftJoin(documentLikes, eq(documentLikes.documentId, documents.id))
    .where(and(...filters))
    .groupBy(documents.id)
    .orderBy(...orderBy)
    .limit(safeLimit)

  return publishedArticles
}

// Public fetch: only returns the document if it is PUBLISHED.
export const getPublishedDocumentById = async (
  db: DB,
  id: string
): Promise<DocumentMeta | undefined> => {
  const [row] = await db
    .select(documentMetaColumns)
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.status, 'PUBLISHED')))
    .limit(1)
  return row
}

export type PublishedDocument = DocumentMeta & { html: string }

/**
 * A published post with its rendered HTML. Matches by slug, falling back to
 * the id for legacy links. If the HTML was never rendered (a legacy post whose
 * room hasn't seeded yet), the room renders it now.
 */
export const getPublishedArticleBySlug = async (
  db: DB,
  slug: string
): Promise<PublishedDocument | undefined> => {
  const [article] = await db
    .select(documentMetaColumns)
    .from(documents)
    .where(
      and(or(eq(documents.slug, slug), eq(documents.id, slug)), eq(documents.status, 'PUBLISHED'))
    )
    .limit(1)
  if (!article) return undefined

  let html = await readPublishedHtml(db, article.id)
  if (html === null) {
    await (await openRoom(article.id)).flushNow()
    html = (await readPublishedHtml(db, article.id)) ?? ''
  }
  return { ...article, html }
}

// Filter by type and status

type GetDocumentsByTypeAndStatusData = {
  status: DocumentStatus
}

export const getDocumentsByTypeAndStatus = async (
  db: DB,
  data: GetDocumentsByTypeAndStatusData,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<Omit<PublishedArticle, 'likeCount'>[]> => {
  const safeLimit = Math.min(limit, MAX_PAGE_SIZE)

  const results = await db
    .select({
      id: documents.id,
      slug: documents.slug,
      title: documents.title,
      subtitle: documents.subtitle,
      status: documents.status,
      userId: documents.userId,
      bannerImage: documents.bannerImage,
      scheduledDate: documents.scheduledDate,
      publishedDate: documents.publishedDate,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      metaTitle: documents.metaTitle,
      metaDescription: documents.metaDescription,
      metaKeywords: documents.metaKeywords,
      canonicalUrl: documents.canonicalUrl,
      ogImage: documents.ogImage,
      readingTime: documents.readingTime,
      wordCount: documents.wordCount,
      excerpt: documents.excerpt,
      isFeatured: documents.isFeatured,
    })
    .from(documents)
    .where(and(eq(documents.status, data.status)))
    .orderBy(desc(documents.createdAt))
    .limit(safeLimit)

  return results
}

export type DocumentSearchResult = {
  id: string
  title: string | null
  subtitle: string | null
  // Title with FTS highlight markers (\u0002 … \u0003) around matched terms.
  titleHighlighted: string | null
  // Excerpt from the body around the best match, same markers — null when the
  // match was in the title/subtitle only.
  snippet: string | null
}

// Turn a raw user query into a safe FTS5 MATCH expression. We split on anything
// that isn't a letter/number — which drops FTS operators and punctuation that
// would otherwise be a syntax error — then prefix-match each token (`term*`) so
// results refine as the user types. Tokens are implicitly AND-ed.
const toFtsMatch = (raw: string): string | null => {
  const tokens = raw.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (tokens.length === 0) return null
  return tokens.map((token) => `${token}*`).join(' ')
}

/**
 * Full-text search across the user's documents using the chunked
 * `document_search_fts` index (BM25, title weighted highest). Each document
 * appears once, with the snippet from its best-matching chunk. `char(2)` /
 * `char(3)` mark highlights — control characters that never occur in real
 * content, so the client can split on them without any risk of HTML injection.
 */
export const searchUserDocuments = async (
  db: DB,
  { userId, query, limit }: { userId: string; query: string; limit: number }
): Promise<DocumentSearchResult[]> => {
  const match = toFtsMatch(query)
  if (!match) return []

  const rows = await db.all<{
    id: string
    title: string | null
    subtitle: string | null
    title_hl: string | null
    snippet: string | null
  }>(sql`
    SELECT
      s.document_id AS id,
      d.title AS title,
      d.subtitle AS subtitle,
      highlight(document_search_fts, 0, char(2), char(3)) AS title_hl,
      snippet(document_search_fts, 2, char(2), char(3), '…', 10) AS snippet
    FROM document_search_fts
    JOIN document_search s ON s.id = document_search_fts.rowid
    JOIN documents d ON d.id = s.document_id
    WHERE document_search_fts MATCH ${match}
      AND s.user_id = ${userId}
    ORDER BY bm25(document_search_fts, 10.0, 5.0, 1.0)
    LIMIT ${limit * 4}
  `)

  const seen = new Set<string>()
  const results: DocumentSearchResult[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    results.push({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      titleHighlighted: row.title_hl,
      // Only surface the body snippet when it actually contains a highlighted
      // match; otherwise it's just the start of the chunk and adds noise.
      snippet: row.snippet?.includes('\u0002') ? row.snippet : null,
    })
    if (results.length >= limit) break
  }
  return results
}
