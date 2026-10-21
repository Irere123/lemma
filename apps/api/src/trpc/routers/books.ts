import { citedReferenceIds } from '@lemma/content'
import { validateContent } from '@lemma/content/schema'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import {
  addBookEntry,
  bookEntries,
  createBook,
  deleteBook,
  getPublishedBook,
  getUserBook,
  listBooks,
  reorderBook,
  updateBook,
} from '@api/db/queries/books'
import { CLIENT_ID_PATTERN, deleteDocument, getUserDocumentById } from '@api/db/queries/documents'
import { documentStatus } from '@api/db/schema'
import {
  findMatches,
  mergeContent,
  moveBlocks,
  splitContent,
  splitTitle,
} from '@api/lib/documents/chapters'
import { citationStyleOf, loadReferences } from '@api/lib/documents/render-context'
import { openRoom } from '@api/lib/documents/room'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../init'

const bookId = z.object({ bookId: z.string() })
const search = z.object({
  find: z.string().min(1).max(500),
  caseSensitive: z.boolean().optional(),
  wholeWord: z.boolean().optional(),
})

async function ownBook(db: Parameters<typeof getUserBook>[0], id: string, userId: string) {
  const book = await getUserBook(db, id, userId)
  if (!book) throw new TRPCError({ code: 'NOT_FOUND', message: 'Book not found' })
  return book
}

async function ownChapter(
  db: Parameters<typeof getUserDocumentById>[0],
  id: string,
  userId: string,
  bookId?: string
) {
  const doc = await getUserDocumentById(db, id, userId)
  if (!doc || doc.kind !== 'chapter' || !doc.bookId || (bookId && doc.bookId !== bookId)) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Chapter not found' })
  }
  return doc
}

const chapterIds = async (db: Parameters<typeof bookEntries>[0], id: string) =>
  (await bookEntries(db, id)).filter((entry) => entry.kind === 'chapter').map((entry) => entry.id)

export const booksRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx: { db, user } }) => listBooks(db, user.id)),

  /** The book and its outline (chapters and parts, in order). */
  get: protectedProcedure.input(bookId).query(async ({ ctx: { db, user }, input }) => {
    const book = await ownBook(db, input.bookId, user.id)
    return { book, entries: await bookEntries(db, book.id) }
  }),

  create: protectedProcedure
    .input(z.object({ title: z.string().max(300).optional() }))
    .mutation(({ ctx: { db, user }, input }) => createBook(db, user.id, input)),

  update: protectedProcedure
    .input(
      bookId.extend({
        title: z.string().max(300).optional(),
        subtitle: z.string().max(500).nullable().optional(),
        description: z.string().max(5000).nullable().optional(),
        coverImage: z.string().url().nullable().optional(),
        wordTarget: z.number().int().min(0).max(10_000_000).nullable().optional(),
        status: z.enum(documentStatus).optional(),
      })
    )
    .mutation(async ({ ctx: { db, user }, input }) => {
      const { bookId: id, ...update } = input
      await ownBook(db, id, user.id)
      return updateBook(db, id, user.id, update)
    }),

  delete: protectedProcedure
    .input(bookId.extend({ keepChapters: z.boolean() }))
    .mutation(async ({ ctx: { db, user }, input }) => {
      const result = await deleteBook(db, input.bookId, user.id, input.keepChapters)
      if (!result.deleted) throw new TRPCError({ code: 'NOT_FOUND', message: 'Book not found' })
      for (const id of result.chapterIds) await deleteDocument(db, id, user.id)
      return { deleted: true }
    }),

  /** A new chapter (or part divider) after `afterId`, or at the end. */
  addEntry: protectedProcedure
    .input(
      bookId.extend({
        kind: z.enum(['chapter', 'part']),
        title: z.string().max(300).optional(),
        afterId: z.string().nullable().optional(),
        id: z.string().regex(CLIENT_ID_PATTERN).optional(),
      })
    )
    .mutation(async ({ ctx: { db, user }, input }) => {
      const book = await ownBook(db, input.bookId, user.id)
      const created = await addBookEntry(db, user.id, book, input)
      if (!created) throw new TRPCError({ code: 'CONFLICT', message: 'That id is taken' })
      return created
    }),

  reorder: protectedProcedure
    .input(bookId.extend({ ids: z.array(z.string()).max(2000) }))
    .mutation(async ({ ctx: { db, user }, input }) => {
      await ownBook(db, input.bookId, user.id)
      await reorderBook(db, input.bookId, input.ids)
      return bookEntries(db, input.bookId)
    }),

  /** Split a chapter before a block; the rest becomes the next chapter. */
  splitChapter: protectedProcedure
    .input(bookId.extend({ chapterId: z.string(), blockId: z.string() }))
    .mutation(async ({ ctx: { db, user }, input }) => {
      const book = await ownBook(db, input.bookId, user.id)
      const chapter = await ownChapter(db, input.chapterId, user.id, book.id)
      const room = await openRoom(chapter.id)
      const fields = await room.read()
      const halves = splitContent(fields.content, input.blockId)
      if (!halves) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nothing to split off there' })
      }
      const next = await addBookEntry(db, user.id, book, {
        kind: 'chapter',
        afterId: chapter.id,
        title: splitTitle(halves.second) ?? `${chapter.title || 'Untitled'} (continued)`,
      })
      if (!next) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
      // The new chapter gets its text before the old one loses it.
      await (await openRoom(next.id)).applyEdit({
        content: validateContent(halves.second, { strict: true }),
      })
      await room.applyEdit(
        { content: validateContent(halves.first, { strict: true }) },
        { revisionBefore: 'before-split' }
      )
      return { chapterId: next.id }
    }),

  /** Append the chapter after this one to it, and remove that chapter. */
  mergeWithNext: protectedProcedure
    .input(bookId.extend({ chapterId: z.string() }))
    .mutation(async ({ ctx: { db, user }, input }) => {
      const book = await ownBook(db, input.bookId, user.id)
      const chapter = await ownChapter(db, input.chapterId, user.id, book.id)
      const ids = await chapterIds(db, book.id)
      const nextId = ids[ids.indexOf(chapter.id) + 1]
      if (!nextId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This is the last chapter' })
      const next = await ownChapter(db, nextId, user.id, book.id)
      const room = await openRoom(chapter.id)
      const [first, second] = [await room.read(), await (await openRoom(next.id)).read()]
      await room.applyEdit(
        {
          content: validateContent(mergeContent(first.content, second.content, second.title), {
            strict: true,
          }),
        },
        { revisionBefore: 'before-merge' }
      )
      await deleteDocument(db, next.id, user.id)
      return { removedId: next.id }
    }),

  /** Move blocks (a scene) to the start or end of another chapter. */
  moveBlocks: protectedProcedure
    .input(
      bookId.extend({
        fromId: z.string(),
        toId: z.string(),
        blockIds: z.array(z.string()).min(1).max(500),
        where: z.enum(['start', 'end']),
      })
    )
    .mutation(async ({ ctx: { db, user }, input }) => {
      if (input.fromId === input.toId) return { moved: 0 }
      const book = await ownBook(db, input.bookId, user.id)
      const from = await ownChapter(db, input.fromId, user.id, book.id)
      const to = await ownChapter(db, input.toId, user.id, book.id)
      const [fromRoom, toRoom] = [await openRoom(from.id), await openRoom(to.id)]
      const result = moveBlocks(
        (await fromRoom.read()).content,
        (await toRoom.read()).content,
        input.blockIds,
        input.where
      )
      if (result.moved === 0) return { moved: 0 }
      await toRoom.applyEdit(
        { content: validateContent(result.to, { strict: true }) },
        { revisionBefore: 'before-merge' }
      )
      await fromRoom.applyEdit(
        { content: validateContent(result.from, { strict: true }) },
        { revisionBefore: 'before-split' }
      )
      return { moved: result.moved }
    }),

  /** Matches across every chapter, with context. */
  find: protectedProcedure
    .input(bookId.merge(search))
    .query(async ({ ctx: { db, user }, input }) => {
      const book = await ownBook(db, input.bookId, user.id)
      const entries = (await bookEntries(db, book.id)).filter((entry) => entry.kind === 'chapter')
      const chapters = await Promise.all(
        entries.map(async (entry) => {
          const fields = await (await openRoom(entry.id)).read()
          return { id: entry.id, title: entry.title, ...findMatches(fields, input) }
        })
      )
      return {
        total: chapters.reduce((sum, chapter) => sum + chapter.count, 0),
        chapters: chapters.filter((chapter) => chapter.count > 0),
      }
    }),

  /**
   * Replace every match in every chapter. Each changed chapter keeps a
   * revision from just before, so `undoReplace` puts them all back.
   */
  replaceAll: protectedProcedure
    .input(bookId.merge(search).extend({ replace: z.string().max(500) }))
    .mutation(async ({ ctx: { db, user }, input }) => {
      const book = await ownBook(db, input.bookId, user.id)
      const { bookId: _id, ...replace } = input
      const changed: { id: string; count: number }[] = []
      for (const id of await chapterIds(db, book.id)) {
        const count = await (await openRoom(id)).replaceText(replace)
        if (count > 0) changed.push({ id, count })
      }
      return { total: changed.reduce((sum, chapter) => sum + chapter.count, 0), chapters: changed }
    }),

  undoReplace: protectedProcedure
    .input(bookId.extend({ chapterIds: z.array(z.string()).max(2000) }))
    .mutation(async ({ ctx: { db, user }, input }) => {
      const book = await ownBook(db, input.bookId, user.id)
      const inBook = new Set(await chapterIds(db, book.id))
      let restored = 0
      for (const id of input.chapterIds.filter((chapterId) => inBook.has(chapterId))) {
        const room = await openRoom(id)
        const revision = (await room.listRevisions()).find(
          (entry) => entry.reason === 'before-replace'
        )
        if (revision && (await room.restoreRevision(revision.id))) restored++
      }
      return { restored }
    }),

  /** Everything a client-side EPUB/DOCX export needs. */
  exportData: protectedProcedure.input(bookId).query(async ({ ctx: { db, user }, input }) => {
    const book = await ownBook(db, input.bookId, user.id)
    const entries = await bookEntries(db, book.id)
    const chapters = []
    let part: string | undefined
    for (const entry of entries) {
      if (entry.kind === 'part') {
        part = entry.title ?? undefined
        continue
      }
      if (entry.kind !== 'chapter') continue
      const { fields, citationStyle } = await (await openRoom(entry.id)).readForRender()
      chapters.push({
        id: entry.id,
        title: fields.title,
        part,
        content: fields.content,
        citationStyle: citationStyleOf(citationStyle),
      })
    }
    const cited = [...new Set(chapters.flatMap((chapter) => citedReferenceIds(chapter.content)))]
    return {
      book,
      author: user.name,
      chapters,
      references: await loadReferences(db, user.id, cited),
    }
  }),

  /** A published book page. */
  getPublished: publicProcedure
    .input(z.object({ username: z.string(), slug: z.string() }))
    .query(({ ctx: { db }, input }) => getPublishedBook(db, input.username, input.slug)),
})
