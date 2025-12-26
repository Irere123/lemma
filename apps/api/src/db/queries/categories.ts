import { and, eq, desc, ne, sql } from 'drizzle-orm'
import type { DB } from '@api/db'
import {
  categories,
  tags,
  documentCategories,
  documentTags,
  documents,
  type Category,
  type Tag,
} from '@api/db/schema'
import { generateId } from '@api/lib/utils'
import { slugifyString } from '@api/db/utils/slugify'

// Category CRUD
export type CreateCategoryData = {
  name: string
  description?: string
  color?: string
  writerId: string
  parentId?: string
}

export type UpdateCategoryData = {
  id: string
  name?: string
  description?: string
  color?: string
  parentId?: string | null
}

async function ensureUniqueCategorySlug(
  db: DB,
  writerId: string,
  base: string,
  excludeId?: string
): Promise<string> {
  let candidate = base || 'category'
  let suffix = 0

  while (true) {
    const whereClause = excludeId
      ? and(
          eq(categories.slug, candidate),
          eq(categories.writerId, writerId),
          ne(categories.id, excludeId)
        )
      : and(eq(categories.slug, candidate), eq(categories.writerId, writerId))

    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(whereClause)
      .limit(1)

    if (existing.length === 0) return candidate
    suffix += 1
    candidate = `${base}-${suffix}`
  }
}

export const createCategory = async (db: DB, data: CreateCategoryData): Promise<Category> => {
  const slug = await ensureUniqueCategorySlug(
    db,
    data.writerId,
    slugifyString(data.name) || 'category'
  )

  const [category] = await db
    .insert(categories)
    .values({
      id: generateId('cat'),
      name: data.name,
      slug,
      description: data.description,
      color: data.color || '#6366f1',
      writerId: data.writerId,
      parentId: data.parentId,
    })
    .returning()

  if (!category) {
    throw new Error('Failed to create category')
  }

  return category
}

export const updateCategory = async (
  db: DB,
  data: UpdateCategoryData
): Promise<Category | undefined> => {
  const existing = await getCategoryById(db, data.id)
  if (!existing) return undefined

  const updateValues: any = { updatedAt: new Date() }

  if (data.name !== undefined) {
    updateValues.name = data.name
    updateValues.slug = await ensureUniqueCategorySlug(
      db,
      existing.writerId,
      slugifyString(data.name) || 'category',
      data.id
    )
  }
  if (data.description !== undefined) updateValues.description = data.description
  if (data.color !== undefined) updateValues.color = data.color
  if (data.parentId !== undefined) updateValues.parentId = data.parentId

  const [category] = await db
    .update(categories)
    .set(updateValues)
    .where(eq(categories.id, data.id))
    .returning()

  return category
}

export const getCategoryById = async (db: DB, id: string): Promise<Category | undefined> => {
  const [category] = await db.select().from(categories).where(eq(categories.id, id)).limit(1)

  return category
}

export const getCategoriesByWriter = async (db: DB, writerId: string): Promise<Category[]> => {
  return db
    .select()
    .from(categories)
    .where(eq(categories.writerId, writerId))
    .orderBy(desc(categories.createdAt))
}

export const deleteCategory = async (db: DB, id: string): Promise<void> => {
  await db.delete(categories).where(eq(categories.id, id))
}

// Document Categories
export const addDocumentCategory = async (
  db: DB,
  documentId: string,
  categoryId: string
): Promise<void> => {
  await db
    .insert(documentCategories)
    .values({
      id: generateId('dc'),
      documentId,
      categoryId,
    })
    .onConflictDoNothing()
}

export const removeDocumentCategory = async (
  db: DB,
  documentId: string,
  categoryId: string
): Promise<void> => {
  await db
    .delete(documentCategories)
    .where(
      and(
        eq(documentCategories.documentId, documentId),
        eq(documentCategories.categoryId, categoryId)
      )
    )
}

export const getDocumentCategories = async (db: DB, documentId: string): Promise<Category[]> => {
  const result = await db
    .select({ category: categories })
    .from(documentCategories)
    .innerJoin(categories, eq(documentCategories.categoryId, categories.id))
    .where(eq(documentCategories.documentId, documentId))

  return result.map((r) => r.category)
}

export const getDocumentsByCategory = async (
  db: DB,
  categoryId: string,
  options?: { limit?: number; publishedOnly?: boolean }
): Promise<any[]> => {
  const conditions = [eq(documentCategories.categoryId, categoryId)]

  if (options?.publishedOnly) {
    conditions.push(eq(documents.status, 'PUBLISHED'))
  }

  const result = await db
    .select({ document: documents })
    .from(documentCategories)
    .innerJoin(documents, eq(documentCategories.documentId, documents.id))
    .where(and(...conditions))
    .orderBy(desc(documents.publishedDate))
    .limit(options?.limit || 20)

  return result.map((r) => r.document)
}

// Tags CRUD
export type CreateTagData = {
  name: string
  writerId: string
}

async function ensureUniqueTagSlug(
  db: DB,
  writerId: string,
  base: string,
  excludeId?: string
): Promise<string> {
  let candidate = base || 'tag'
  let suffix = 0

  while (true) {
    const whereClause = excludeId
      ? and(eq(tags.slug, candidate), eq(tags.writerId, writerId), ne(tags.id, excludeId))
      : and(eq(tags.slug, candidate), eq(tags.writerId, writerId))

    const existing = await db.select({ id: tags.id }).from(tags).where(whereClause).limit(1)

    if (existing.length === 0) return candidate
    suffix += 1
    candidate = `${base}-${suffix}`
  }
}

export const createTag = async (db: DB, data: CreateTagData): Promise<Tag> => {
  const slug = await ensureUniqueTagSlug(db, data.writerId, slugifyString(data.name) || 'tag')

  const [tag] = await db
    .insert(tags)
    .values({
      id: generateId('tag'),
      name: data.name,
      slug,
      writerId: data.writerId,
    })
    .returning()

  if (!tag) {
    throw new Error('Failed to create tag')
  }

  return tag
}

export const getOrCreateTag = async (db: DB, name: string, writerId: string): Promise<Tag> => {
  const slug = slugifyString(name) || 'tag'

  const [existing] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.slug, slug), eq(tags.writerId, writerId)))
    .limit(1)

  if (existing) return existing

  return createTag(db, { name, writerId })
}

export const getTagById = async (db: DB, id: string): Promise<Tag | undefined> => {
  const [tag] = await db.select().from(tags).where(eq(tags.id, id)).limit(1)
  return tag
}

export const getTagsByWriter = async (db: DB, writerId: string): Promise<Tag[]> => {
  return db.select().from(tags).where(eq(tags.writerId, writerId)).orderBy(desc(tags.createdAt))
}

export const deleteTag = async (db: DB, id: string): Promise<void> => {
  await db.delete(tags).where(eq(tags.id, id))
}

// Document Tags
export const addDocumentTag = async (db: DB, documentId: string, tagId: string): Promise<void> => {
  await db
    .insert(documentTags)
    .values({
      id: generateId('dt'),
      documentId,
      tagId,
    })
    .onConflictDoNothing()

  // Increment usage count
  await db
    .update(tags)
    .set({
      usageCount: sql`(${tags.usageCount}::int + 1)::text`,
    })
    .where(eq(tags.id, tagId))
}

export const removeDocumentTag = async (
  db: DB,
  documentId: string,
  tagId: string
): Promise<void> => {
  await db
    .delete(documentTags)
    .where(and(eq(documentTags.documentId, documentId), eq(documentTags.tagId, tagId)))

  // Decrement usage count
  await db
    .update(tags)
    .set({
      usageCount: sql`greatest(0, ${tags.usageCount}::int - 1)::text`,
    })
    .where(eq(tags.id, tagId))
}

export const getDocumentTags = async (db: DB, documentId: string): Promise<Tag[]> => {
  const result = await db
    .select({ tag: tags })
    .from(documentTags)
    .innerJoin(tags, eq(documentTags.tagId, tags.id))
    .where(eq(documentTags.documentId, documentId))

  return result.map((r) => r.tag)
}

export const getDocumentsByTag = async (
  db: DB,
  tagId: string,
  options?: { limit?: number; publishedOnly?: boolean }
): Promise<any[]> => {
  const conditions = [eq(documentTags.tagId, tagId)]

  if (options?.publishedOnly) {
    conditions.push(eq(documents.status, 'PUBLISHED'))
  }

  const result = await db
    .select({ document: documents })
    .from(documentTags)
    .innerJoin(documents, eq(documentTags.documentId, documents.id))
    .where(and(...conditions))
    .orderBy(desc(documents.publishedDate))
    .limit(options?.limit || 20)

  return result.map((r) => r.document)
}

// Sync document tags (replace all tags)
export const syncDocumentTags = async (
  db: DB,
  documentId: string,
  tagNames: string[],
  writerId: string
): Promise<Tag[]> => {
  // Remove existing tags
  await db.delete(documentTags).where(eq(documentTags.documentId, documentId))

  // Add new tags
  const newTags: Tag[] = []
  for (const name of tagNames) {
    const tag = await getOrCreateTag(db, name, writerId)
    await addDocumentTag(db, documentId, tag.id)
    newTags.push(tag)
  }

  return newTags
}
