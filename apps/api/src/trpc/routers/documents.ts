import { TRPCError } from '@trpc/server'
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
import { getWriterNewsletterSettings } from '@api/db/queries/newsletter-settings'
import { getConfirmedSubscribers } from '@api/db/queries/subscribers'
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

  getDocumentById: publicProcedure
    .input(documentByIdSchema)
    .query(async ({ ctx: { db }, input }) => {
      return getDocumentById(db, input.id)
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
      const document = await upsertDocument(ctx.db, input, ctx.user.id)
      return document
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
