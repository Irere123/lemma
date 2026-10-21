import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'

import type { DB } from '@api/db'
import { type Book, books, documents, user } from '@api/db/schema'
import { slugifyString } from '@api/db/utils/slugify'
import { generateId } from '@api/lib/utils'
import { createDocument, type DocumentMeta, documentMetaColumns } from './documents'

/** One row of a book's outline: a chapter or a part divider. */
export type BookEntry = Pick<
  DocumentMeta,
  | 'id'
  | 'title'
  | 'kind'
  | 'position'
  | 'status'
  | 'slug'
  | 'wordCount'
  | 'wordTarget'
  | 'updatedAt'
  | 'publishedDate'
  | 'excerpt'
>

const entryColumns = {
  id: documents.id,
  title: documents.title,
  kind: documents.kind,
  position: documents.position,
  status: documents.status,
  slug: documents.slug,
  wordCount: documents.wordCount,
  wordTarget: documents.wordTarget,
  updatedAt: documents.updatedAt,
  publishedDate: documents.publishedDate,
  excerpt: documents.excerpt,
}

export async function ensureUniqueBookSlug(db: DB, base: string, excludeId?: string) {
  let candidate = base || 'book'
  for (let suffix = 1; ; suffix++) {
    const [taken] = await db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.slug, candidate))
      .limit(1)
    if (!taken || taken.id === excludeId) return candidate
    candidate = `${base}-${suffix}`
  }
}

export type BookSummary = Book & { chapters: number; words: number }

/** A writer's books, most recently edited first, with chapter and word counts. */
export async function listBooks(db: DB, userId: string): Promise<BookSummary[]> {
  const rows = await db
    .select({
      book: books,
      chapters: sql<number>`count(${documents.id}) filter (where ${documents.kind} = 'chapter')`,
      words: sql<number>`coalesce(sum(cast(${documents.wordCount} as integer)) filter (where ${documents.kind} = 'chapter'), 0)`,
    })
    .from(books)
    .leftJoin(documents, eq(documents.bookId, books.id))
    .where(eq(books.userId, userId))
    .groupBy(books.id)
    .orderBy(desc(books.updatedAt))
  return rows.map((row) => ({
    ...row.book,
    chapters: Number(row.chapters),
    words: Number(row.words),
  }))
}

export async function getUserBook(db: DB, id: string, userId: string): Promise<Book | undefined> {
  const [book] = await db
    .select()
    .from(books)
    .where(and(eq(books.id, id), eq(books.userId, userId)))
    .limit(1)
  return book
}

/** The book's outline in order. */
export async function bookEntries(db: DB, bookId: string): Promise<BookEntry[]> {
  return db
    .select(entryColumns)
    .from(documents)
    .where(eq(documents.bookId, bookId))
    .orderBy(asc(documents.position), asc(documents.createdAt))
}

export async function createBook(
  db: DB,
  userId: string,
  input: { title?: string | null }
): Promise<{ book: Book; firstChapter: DocumentMeta | undefined }> {
  const id = generateId()
  const title = input.title?.trim() || 'Untitled book'
  const now = new Date()
  await db.insert(books).values({
    id,
    userId,
    title,
    slug: await ensureUniqueBookSlug(db, slugifyString(title) || id),
    createdAt: now,
    updatedAt: now,
  })
  // A new book opens on its first chapter.
  const firstChapter = await createDocument(db, userId, {
    kind: 'chapter',
    bookId: id,
    position: 0,
    title: 'Chapter 1',
  })
  const book = (await getUserBook(db, id, userId)) as Book
  return { book, firstChapter }
}

export type BookUpdate = Partial<
  Pick<Book, 'title' | 'subtitle' | 'description' | 'coverImage' | 'wordTarget' | 'status'>
>

export async function updateBook(db: DB, id: string, userId: string, update: BookUpdate) {
  const values: Partial<typeof books.$inferInsert> = { ...update, updatedAt: new Date() }
  if (update.title !== undefined) {
    const title = update.title?.trim() || 'Untitled book'
    values.title = title
    // The public URL follows the title until the book is published.
    const current = await getUserBook(db, id, userId)
    if (current && current.status !== 'PUBLISHED') {
      values.slug = await ensureUniqueBookSlug(db, slugifyString(title) || id, id)
    }
  }
  await db
    .update(books)
    .set(values)
    .where(and(eq(books.id, id), eq(books.userId, userId)))
  return getUserBook(db, id, userId)
}

/**
 * Put entries in the given order (positions 0…n-1). Ids not in the book are
 * ignored; entries missing from the list keep their relative order after it.
 */
export async function reorderBook(db: DB, bookId: string, ids: string[]) {
  const entries = await bookEntries(db, bookId)
  const known = new Set(entries.map((entry) => entry.id))
  const ordered = [
    ...ids.filter((id) => known.has(id)),
    ...entries.map((entry) => entry.id).filter((id) => !ids.includes(id)),
  ]
  const statements = ordered.map((id, position) =>
    db.update(documents).set({ position }).where(eq(documents.id, id))
  )
  if (statements.length > 0) {
    await db.batch(statements as [(typeof statements)[number], ...typeof statements])
  }
  await db.update(books).set({ updatedAt: new Date() }).where(eq(books.id, bookId))
}

/**
 * Add a chapter or part after `afterId` (or at the end) and shift what
 * follows. Returns the new document.
 */
export async function addBookEntry(
  db: DB,
  userId: string,
  book: Book,
  input: { kind: 'chapter' | 'part'; title?: string | null; afterId?: string | null; id?: string }
): Promise<DocumentMeta | undefined> {
  const entries = await bookEntries(db, book.id)
  const index = input.afterId ? entries.findIndex((entry) => entry.id === input.afterId) : -1
  const at = index === -1 ? entries.length : index + 1
  const chapters = entries.filter((entry) => entry.kind === 'chapter').length
  const created = await createDocument(db, userId, {
    id: input.id,
    kind: input.kind,
    bookId: book.id,
    position: at,
    title: input.title ?? (input.kind === 'part' ? 'New part' : `Chapter ${chapters + 1}`),
  })
  if (!created) return undefined
  const order = entries.map((entry) => entry.id)
  order.splice(at, 0, created.id)
  await reorderBook(db, book.id, order)
  return created
}

/** Delete a book; its chapters are deleted with it or become standalone posts. */
export async function deleteBook(
  db: DB,
  id: string,
  userId: string,
  keepChapters: boolean
): Promise<{ deleted: boolean; chapterIds: string[] }> {
  const book = await getUserBook(db, id, userId)
  if (!book) return { deleted: false, chapterIds: [] }
  const entries = await bookEntries(db, id)
  const chapterIds = entries.filter((entry) => entry.kind === 'chapter').map((entry) => entry.id)
  const partIds = entries.filter((entry) => entry.kind === 'part').map((entry) => entry.id)
  if (keepChapters && chapterIds.length > 0) {
    await db
      .update(documents)
      .set({ kind: 'post', bookId: null, position: null })
      .where(inArray(documents.id, chapterIds))
  }
  if (partIds.length > 0) await db.delete(documents).where(inArray(documents.id, partIds))
  await db.delete(books).where(and(eq(books.id, id), eq(books.userId, userId)))
  return { deleted: true, chapterIds: keepChapters ? [] : chapterIds }
}

export type PublishedBook = Pick<
  Book,
  'id' | 'title' | 'subtitle' | 'description' | 'coverImage' | 'slug'
> & {
  author: { name: string; username: string | null; image: string | null }
  /** Published chapters in order, with the parts that contain any of them. */
  entries: BookEntry[]
}

/** A published book page: the book and its published chapters, in order. */
export async function getPublishedBook(
  db: DB,
  username: string,
  slug: string
): Promise<PublishedBook | null> {
  const [row] = await db
    .select({ book: books, name: user.name, username: user.username, image: user.image })
    .from(books)
    .innerJoin(user, eq(user.id, books.userId))
    .where(and(eq(user.username, username), eq(books.slug, slug), eq(books.status, 'PUBLISHED')))
    .limit(1)
  if (!row) return null
  const entries = await bookEntries(db, row.book.id)
  return {
    id: row.book.id,
    title: row.book.title,
    subtitle: row.book.subtitle,
    description: row.book.description,
    coverImage: row.book.coverImage,
    slug: row.book.slug,
    author: { name: row.name, username: row.username, image: row.image },
    entries: publishedOutline(entries),
  }
}

/** Published chapters, plus each part that heads at least one of them. */
export function publishedOutline(entries: BookEntry[]): BookEntry[] {
  const out: BookEntry[] = []
  let part: BookEntry | null = null
  for (const entry of entries) {
    if (entry.kind === 'part') {
      part = entry
      continue
    }
    if (entry.kind !== 'chapter' || entry.status !== 'PUBLISHED') continue
    if (part) {
      out.push(part)
      part = null
    }
    out.push(entry)
  }
  return out
}

/**
 * For a published chapter's page: its book (if published) and the previous
 * and next published chapters.
 */
export async function chapterContext(db: DB, documentId: string) {
  const [doc] = await db
    .select({ bookId: documents.bookId, kind: documents.kind })
    .from(documents)
    .where(and(eq(documents.id, documentId), isNotNull(documents.bookId)))
    .limit(1)
  if (!doc?.bookId || doc.kind !== 'chapter') return null
  const [book] = await db
    .select({ id: books.id, title: books.title, slug: books.slug, status: books.status })
    .from(books)
    .where(eq(books.id, doc.bookId))
    .limit(1)
  if (!book) return null
  const chapters = publishedOutline(await bookEntries(db, book.id)).filter(
    (entry) => entry.kind === 'chapter'
  )
  const index = chapters.findIndex((entry) => entry.id === documentId)
  if (index === -1) return null
  const link = (entry: BookEntry | undefined) =>
    entry ? { id: entry.id, title: entry.title, slug: entry.slug } : null
  return {
    book: { title: book.title, slug: book.slug, published: book.status === 'PUBLISHED' },
    number: index + 1,
    total: chapters.length,
    previous: link(chapters[index - 1]),
    next: link(chapters[index + 1]),
  }
}

export { documentMetaColumns }
