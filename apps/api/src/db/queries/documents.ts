import { and, desc, eq, lt, ne } from 'drizzle-orm'

import type { DB } from '@api/db'
import { type Document, type DocumentStatus, documents } from '@api/db/schema'
import { slugifyString } from '@api/db/utils/slugify'
import { generateId } from '@api/lib/utils'
import type { UpsertDocumentData } from '@api/schemas'

// Default page size for pagination
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

const normalizeMarkdown = (markdown: string) => markdown.replaceAll('\r\n', '\n').trimEnd()

const resolveMarkdownForSave = (data: UpsertDocumentData): string | undefined => {
  if (typeof data.markdown === 'string') {
    return normalizeMarkdown(data.markdown)
  }

  if (data.markdown === null) {
    // Database column is non-nullable in production, so treat null as empty content.
    return ''
  }

  return undefined
}

async function ensureUniqueSlug(db: DB, base: string, excludeId?: string): Promise<string> {
  let candidate = base || 'post'
  let suffix = 0
  // Check if exists; if so, append incremental suffix
  // Keep attempts bounded reasonably, though realistically collisions are rare
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

export const upsertDocument = async (
  db: DB,
  data: UpsertDocumentData,
  userId: string
): Promise<Document | undefined> => {
  const markdownForSave = resolveMarkdownForSave(data)

  if (data.id) {
    const updateValues: any = { updatedAt: new Date() }

    if (Object.hasOwn(data, 'title')) {
      updateValues.title = data.title ?? null
    }

    if (Object.hasOwn(data, 'subtitle')) {
      updateValues.subtitle = data.subtitle ?? null
    }

    if (Object.hasOwn(data, 'status')) {
      updateValues.status = data.status
    }

    if (Object.hasOwn(data, 'bannerImage')) {
      updateValues.bannerImage = data.bannerImage ?? null
    }

    if (Object.hasOwn(data, 'scheduledDate')) {
      updateValues.scheduledDate = data.scheduledDate ?? null
    }

    if (Object.hasOwn(data, 'publishedDate')) {
      updateValues.publishedDate = data.publishedDate ?? null
    }

    if (markdownForSave !== undefined) {
      // Keep markdown as the canonical editor representation.
      updateValues.markdown = markdownForSave
    }

    if (Object.hasOwn(data, 'title')) {
      const base = slugifyString(data.title ?? generateId())
      const safeBase = base || generateId()
      updateValues.slug = await ensureUniqueSlug(db, safeBase, data.id)
    }

    const [document] = await db
      .update(documents)
      .set(updateValues)
      .where(and(eq(documents.id, data.id), eq(documents.userId, userId)))
      .returning()
    return document
  }

  try {
    const base = slugifyString(data.title ?? generateId())
    const safeBase = base || generateId()
    const slug = await ensureUniqueSlug(db, safeBase)

    const [document] = await db
      .insert(documents)
      .values({
        slug,
        id: generateId(),
        userId,
        title: data.title ?? null,
        subtitle: data.subtitle ?? null,
        status: data.status ?? 'DRAFT',
        markdown: markdownForSave ?? '',
        bannerImage: data.bannerImage ?? null,
        scheduledDate: data.scheduledDate ?? null,
        publishedDate: data.publishedDate ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
    return document
  } catch (error) {
    console.log(error)
  }
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
  return result.length > 0
}

export const getDueScheduledDocuments = async (
  db: DB,
  now: Date = new Date(),
  limit = 50
): Promise<Document[]> => {
  return db
    .select()
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

  // Build filter conditions dynamically
  const filters = [eq(documents.userId, data.userId)]

  if (data.status) {
    filters.push(eq(documents.status, data.status))
  }

  // Add cursor-based pagination
  if (data.cursor) {
    filters.push(lt(documents.createdAt, new Date(data.cursor)))
  }

  const userDocuments = await db
    .select({
      id: documents.id,
      slug: documents.slug,
      title: documents.title,
      subtitle: documents.subtitle,
      status: documents.status,
      userId: documents.userId,
      markdown: documents.markdown,
      bannerImage: documents.bannerImage,
      scheduledDate: documents.scheduledDate,
      publishedDate: documents.publishedDate,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(and(...filters))
    .orderBy(desc(documents.publishedDate))
    .limit(limit + 1) // Fetch one extra to determine if there's a next page

  return userDocuments
}

export const getDocumentById = async (db: DB, id: string) => {
  return db.query.documents.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  })
}

/**
 * Batch-load documents by id (avoids the GraphQL N+1 when resolving
 * `Campaign.document` across a list of campaigns).
 */
export const getDocumentsByIds = async (db: DB, ids: string[]): Promise<Map<string, Document>> => {
  if (ids.length === 0) return new Map()

  const rows = await db.query.documents.findMany({
    where: (table, { inArray }) => inArray(table.id, ids),
  })

  return new Map(rows.map((doc) => [doc.id, doc]))
}

// User-scoped fetch: only returns the document if it belongs to the caller.
export const getUserDocumentById = async (db: DB, id: string, userId: string) => {
  return db.query.documents.findFirst({
    where: (table, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(table.id, id), eqOp(table.userId, userId)),
  })
}

export const getDocumentBySlug = async (db: DB, slug: string) => {
  return db.query.documents.findFirst({
    where: (table, { eq }) => eq(table.slug, slug),
  })
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
    .returning()

  return document
}

type PublishedArticlesOptions = {
  limit?: number
  // Optionally scope the listing to a single writer (e.g. per-writer feeds).
  writerId?: string
}

export const getPublishedArticles = async (
  db: DB,
  options: PublishedArticlesOptions = {}
): Promise<Omit<Document, 'markdown'>[]> => {
  const safeLimit = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

  const filters = [eq(documents.status, 'PUBLISHED')]
  if (options.writerId) {
    filters.push(eq(documents.userId, options.writerId))
  }

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
      isFeatured: documents.isFeatured,
    })
    .from(documents)
    .where(and(...filters))
    .orderBy(desc(documents.publishedDate))
    .limit(safeLimit)

  return publishedArticles
}

// Public fetch: only returns the document if it is PUBLISHED.
export const getPublishedDocumentById = async (
  db: DB,
  id: string
): Promise<Document | undefined> => {
  return db.query.documents.findFirst({
    where: (table, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(table.id, id), eqOp(table.status, 'PUBLISHED')),
  })
}

export const getPublishedArticleBySlug = async (
  db: DB,
  slug: string
): Promise<Document | undefined> => {
  // Prefer matching by slug; fallback to ID for legacy posts without slugs
  const article = await db.query.documents.findFirst({
    where: (table, { and, eq, or }) =>
      and(or(eq(table.slug, slug), eq(table.id, slug)), eq(table.status, 'PUBLISHED')),
  })
  return article
}

// Filter by type and status

type GetDocumentsByTypeAndStatusData = {
  status: DocumentStatus
}

export const getDocumentsByTypeAndStatus = async (
  db: DB,
  data: GetDocumentsByTypeAndStatusData,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<Omit<Document, 'markdown'>[]> => {
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
      isFeatured: documents.isFeatured,
    })
    .from(documents)
    .where(and(eq(documents.status, data.status)))
    .orderBy(desc(documents.createdAt))
    .limit(safeLimit)

  return results
}
