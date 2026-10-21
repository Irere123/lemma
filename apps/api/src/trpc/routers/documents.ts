import { citedReferenceIds, type MarkdownLoss, renderToMarkdown } from '@lemma/content'
import { blockChanges } from '@lemma/content/schema'
import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import {
  deleteDocument,
  getDocumentById,
  getPublishedArticleBySlug,
  getPublishedArticles,
  getUserById,
  getUserDocuments,
  searchUserDocuments,
  updateDocumentBannerImage,
  upsertDocument,
} from '@api/db/queries'
import { chapterContext } from '@api/db/queries/books'
import { CLIENT_ID_PATTERN, createDocument, getUserDocumentById } from '@api/db/queries/documents'
import { getWriterNewsletterSettings } from '@api/db/queries/newsletter-settings'
import { listReferences } from '@api/db/queries/references'
import { getConfirmedSubscribers } from '@api/db/queries/subscribers'
import { documents } from '@api/db/schema'
import { renderPublishedHtml } from '@api/lib/documents/render'
import {
  citationStyleOf,
  citationsFor,
  documentLinkResolver,
  loadReferences,
} from '@api/lib/documents/render-context'
import { ContentValidationError, openRoom, readDocumentContent } from '@api/lib/documents/room'
import { computeNewsletterSchedule } from '@api/lib/scheduling'
import {
  deleteDocumentSchema,
  documentByIdSchema,
  documentsFilters,
  getPublishedArticlesSchema,
  searchDocumentsSchema,
  sendNewsletterSchema,
  updateBannerImageSchema,
  upsertDocumentSchema,
} from '@api/schemas/documents'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../init'

export const documentRouter = createTRPCRouter({
  getPublishedArticles: publicProcedure
    .input(getPublishedArticlesSchema)
    .query(async ({ ctx: { db }, input }) => {
      return getPublishedArticles(db, { writerId: input?.writerId, limit: input?.limit })
    }),

  // Owner-only metadata for the editor. The body syncs over the document's
  // realtime channel, never through this query.
  getDocumentById: protectedProcedure
    .input(documentByIdSchema)
    .query(async ({ ctx: { db, user }, input }) => {
      return (await getUserDocumentById(db, input.id, user.id)) ?? null
    }),

  // "Export as Markdown". The Pandoc flavour keeps citations, figures and
  // cross-references (with a .bib of what's cited) for Pandoc and Quarto.
  getMarkdown: protectedProcedure
    .input(documentByIdSchema.extend({ flavor: z.enum(['gfm', 'pandoc']).optional() }))
    .query(async ({ ctx: { db, user }, input }) => {
      const doc = await getUserDocumentById(db, input.id, user.id)
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      const content = await readDocumentContent(doc.id)
      const pandoc = input.flavor === 'pandoc'
      const library = pandoc ? await listReferences(db, user.id) : []
      const keys = new Map(library.map((item) => [item.id, item.key]))
      // What Markdown couldn't carry, so the writer is told rather than surprised.
      let losses: MarkdownLoss[] = []
      const markdown = renderToMarkdown(content, {
        flavor: input.flavor,
        citationKey: (id) => keys.get(id) ?? id,
        onLoss: (lost) => {
          losses = lost
        },
      })
      const cited = new Set(citedReferenceIds(content))
      const bibliography = pandoc
        ? library
            .filter((item) => cited.has(item.id))
            .map((item) => ({ ...item.csl, id: item.key }))
        : []
      return { title: doc.title, markdown, losses, references: bibliography }
    }),

  /** A document's content and cited references, for a client-side DOCX export. */
  exportData: protectedProcedure
    .input(documentByIdSchema)
    .query(async ({ ctx: { db, user }, input }) => {
      const doc = await getUserDocumentById(db, input.id, user.id)
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      const { fields, citationStyle } = await (await openRoom(doc.id)).readForRender()
      return {
        title: fields.title,
        subtitle: fields.subtitle,
        author: user.name,
        content: fields.content,
        citationStyle: citationStyleOf(citationStyle),
        references: await loadReferences(db, user.id, citedReferenceIds(fields.content)),
      }
    }),

  /** A new, empty document. Notes may bring their own id (created offline). */
  createDocument: protectedProcedure
    .input(
      z.object({
        id: z.string().regex(CLIENT_ID_PATTERN).optional(),
        kind: z.enum(['post', 'note']),
        title: z.string().max(300).optional(),
      })
    )
    .mutation(async ({ ctx: { db, user }, input }) => {
      const created = await createDocument(db, user.id, input)
      if (!created) throw new TRPCError({ code: 'CONFLICT', message: 'That id is taken' })
      return created
    }),

  /** A chapter's (or any document's) word target; null clears it. */
  setWordTarget: protectedProcedure
    .input(
      documentByIdSchema.extend({ wordTarget: z.number().int().min(1).max(10_000_000).nullable() })
    )
    .mutation(async ({ ctx: { db, user }, input }) => {
      await db
        .update(documents)
        .set({ wordTarget: input.wordTarget })
        .where(and(eq(documents.id, input.id), eq(documents.userId, user.id)))
      return getUserDocumentById(db, input.id, user.id)
    }),

  /** Turn a note into a post (N7) or a post back into a note. Chapters stay chapters. */
  setKind: protectedProcedure
    .input(documentByIdSchema.extend({ kind: z.enum(['post', 'note']) }))
    .mutation(async ({ ctx: { db, user }, input }) => {
      const doc = await getUserDocumentById(db, input.id, user.id)
      if (!doc || (doc.kind !== 'post' && doc.kind !== 'note')) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      }
      if (input.kind === 'note' && doc.status === 'PUBLISHED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unpublish it first' })
      }
      await db
        .update(documents)
        .set({ kind: input.kind, journalDate: null, updatedAt: new Date() })
        .where(and(eq(documents.id, doc.id), eq(documents.userId, user.id)))
      return getUserDocumentById(db, doc.id, user.id)
    }),

  // Version history (kept by the document's room).
  listRevisions: protectedProcedure
    .input(documentByIdSchema)
    .query(async ({ ctx: { db, user }, input }) => {
      const doc = await getUserDocumentById(db, input.id, user.id)
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      return (await openRoom(doc.id)).listRevisions()
    }),

  // One past version, rendered as it would be published, plus which blocks
  // differ from the current version.
  getRevision: protectedProcedure
    .input(z.object({ id: z.string(), revisionId: z.number().int().positive() }))
    .query(async ({ ctx: { db, user }, input }) => {
      const doc = await getUserDocumentById(db, input.id, user.id)
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      const room = await openRoom(doc.id)
      const revision = await room.getRevision(input.revisionId)
      if (!revision) throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' })
      const { fields: current, citationStyle } = await room.readForRender()
      const { fields, ...summary } = revision
      const citations = await citationsFor(
        db,
        user.id,
        fields.content,
        citationStyleOf(citationStyle)
      )
      return {
        ...summary,
        subtitle: fields.subtitle,
        html: renderPublishedHtml(fields.content, {
          citations: citations.rendered,
          documentLink: await documentLinkResolver(db, user.id, fields.content),
        }),
        // From this version to the current one.
        changes: blockChanges(fields.content, current.content),
        titleChanged: fields.title !== current.title,
        subtitleChanged: fields.subtitle !== current.subtitle,
      }
    }),

  restoreRevision: protectedProcedure
    .input(z.object({ id: z.string(), revisionId: z.number().int().positive() }))
    .mutation(async ({ ctx: { db, user }, input }) => {
      const doc = await getUserDocumentById(db, input.id, user.id)
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      const restored = await (await openRoom(doc.id)).restoreRevision(input.revisionId)
      if (!restored) throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' })
      return { restored }
    }),

  // Public reader: a PUBLISHED post by slug (or id fallback) with an author
  // byline. Returns null when the post is missing or not yet published.
  getPublishedBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx: { db }, input }) => {
      const doc = await getPublishedArticleBySlug(db, input.slug)
      if (!doc) return null

      const author = doc.userId ? await getUserById(db, doc.userId) : undefined
      return {
        ...doc,
        // A chapter's book and its neighbours, for "Chapter 3 of …" and next/previous.
        chapter: doc.kind === 'chapter' ? await chapterContext(db, doc.id) : null,
        author: author
          ? {
              id: author.id,
              name: author.name,
              username: author.username,
              image: author.image,
            }
          : null,
      }
    }),

  upsertDocument: protectedProcedure
    .input(upsertDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return (await upsertDocument(ctx.db, input, ctx.user.id)) ?? null
      } catch (error) {
        if (error instanceof ContentValidationError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message, cause: error })
        }
        throw error
      }
    }),

  updateBannerImage: protectedProcedure
    .input(updateBannerImageSchema)
    .mutation(async ({ ctx, input }) => {
      if (!input.documentId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Document ID is required',
        })
      }
      return updateDocumentBannerImage(ctx.db, input.documentId, ctx.user.id, input.bannerImage)
    }),

  deleteDocument: protectedProcedure
    .input(deleteDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteDocument(ctx.db, input.id, ctx.user.id)
      if (!deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      }
      return { success: true }
    }),

  getUserDocuments: protectedProcedure
    .input(documentsFilters)
    .query(async ({ ctx: { db, user }, input }) => {
      const userDocuments = await getUserDocuments(db, {
        ...input,
        userId: user.id,
      })

      const hasMore = userDocuments.length > input.limit
      const results = hasMore ? userDocuments.slice(0, input.limit) : userDocuments
      const nextCursor = hasMore ? (results.at(-1)?.createdAt?.toISOString() ?? null) : null
      return {
        documents: results,
        nextCursor,
      }
    }),

  searchDocuments: protectedProcedure
    .input(searchDocumentsSchema)
    .query(async ({ ctx: { db, user }, input }) => {
      return searchUserDocuments(db, {
        userId: user.id,
        query: input.query,
        limit: input.limit,
      })
    }),

  sendNewsletter: protectedProcedure
    .input(sendNewsletterSchema)
    .mutation(async ({ ctx, input }) => {
      const { documentId, sendImmediately } = input

      const document = await getDocumentById(ctx.db, documentId)

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        })
      }

      if (document.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: "You don't have permission to send this document",
        })
      }

      const writerSettings = await getWriterNewsletterSettings(ctx.db, ctx.user.id)

      if (!writerSettings) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Writer newsletter settings not found',
        })
      }

      const subscribers = await getConfirmedSubscribers(ctx.db, ctx.user.id)

      const schedule = computeNewsletterSchedule({
        sendImmediately: sendImmediately ?? false,
        scheduledDate: document.scheduledDate ?? undefined,
      })

      if (subscribers.length === 0) {
        return {
          success: true,
          message: 'No confirmed subscribers found',
          count: 0,
          scheduledFor: schedule.scheduledFor,
          scheduleMode: schedule.mode,
          jobIds: [],
        }
      }

      const recipients = subscribers.map((sub) => ({
        email: sub.email,
        unsubscribeToken: sub.token,
      }))

      const priority = (sendImmediately ?? false) ? 9 : schedule.mode === 'scheduled' ? 6 : 8

      // TODO: Implement newsletter queue integration
      // const emailResults = await enqueueDocumentNewsletter({
      //   env: ctx.env,
      //   document,
      //   writerSettings,
      //   recipients,
      //   options: {
      //     delayMs: schedule.delayMs,
      //     priority,
      //   },
      // });

      // Return placeholder response until newsletter queue is implemented
      return {
        success: true,
        message: `Newsletter queued for ${recipients.length} recipients`,
        count: recipients.length,
        scheduledFor: schedule.scheduledFor,
        scheduleMode: schedule.mode,
        jobIds: [],
      }
    }),
})
