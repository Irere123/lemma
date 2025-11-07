import { TRPCError } from "@trpc/server";
import {
  documentByIdSchema,
  documentsFilters,
  upsertDocumentSchema,
  sendNewsletterSchema,
  deleteDocumentSchema,
  updateBannerImageSchema,
} from "@api/schemas/documents";
import {
  getAdminPublishedArticles,
  getDocumentById,
  getUserDocuments,
  upsertDocument,
  deleteDocument,
  updateDocumentBannerImage,
} from "@api/db/queries";
import { getConfirmedSubscribers } from "@api/db/queries/subscribers";
import { getWriterNewsletterSettings } from "@api/db/queries/newsletter-settings";
import { enqueueDocumentNewsletter } from "@api/services/email-queue";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";

export const documentRouter = createTRPCRouter({
  getAdminPublishedArticles: publicProcedure.query(async ({ ctx: { db } }) => {
    return getAdminPublishedArticles(db);
  }),

  getDocumentById: publicProcedure
    .input(documentByIdSchema)
    .query(async ({ ctx: { db }, input }) => {
      return getDocumentById(db, input.id);
    }),

  upsertDocument: protectedProcedure
    .input(upsertDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      const document = await upsertDocument(ctx.db, input, ctx.user.id);
      return document;
    }),

  updateBannerImage: protectedProcedure
    .input(updateBannerImageSchema)
    .mutation(async ({ ctx, input }) => {
      if (!input.documentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Document ID is required",
        });
      }
      return updateDocumentBannerImage(
        ctx.db,
        input.documentId,
        ctx.user.id,
        input.bannerImage
      );
    }),

  deleteDocument: protectedProcedure
    .input(deleteDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      return deleteDocument(ctx.db, input.id);
    }),

  getUserDocuments: protectedProcedure
    .input(documentsFilters)
    .query(async ({ ctx: { db, user }, input }) => {
      const userDocuments = await getUserDocuments(db, {
        ...input,
        userId: user.id,
      });

      // Check if there are more results
      const hasMore = userDocuments.length > input.limit;
      const results = hasMore
        ? userDocuments.slice(0, input.limit)
        : userDocuments;
      const nextCursor = hasMore
        ? results.at(-1)?.createdAt?.toISOString() ?? null
        : null;
      return {
        documents: results,
        nextCursor,
      };
    }),

  sendNewsletter: protectedProcedure
    .input(sendNewsletterSchema)
    .mutation(async ({ ctx, input }) => {
      const { documentId, sendImmediately } = input;

      const document = await getDocumentById(ctx.db, documentId);

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      if (document.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to send this document",
        });
      }

      const writerSettings = await getWriterNewsletterSettings(
        ctx.db,
        ctx.user.id
      );

      if (!writerSettings) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Writer newsletter settings not found",
        });
      }

      const subscribers = await getConfirmedSubscribers(ctx.db, ctx.user.id);

      if (subscribers.length === 0) {
        return {
          success: true,
          message: "No confirmed subscribers found",
          count: 0,
        };
      }

      const recipients = subscribers.map((sub) => ({
        email: sub.email,
        unsubscribeToken: sub.token,
      }));

      let delayMs = 0;
      if (!sendImmediately && document.scheduledDate) {
        const now = new Date();
        const scheduledTime = new Date(document.scheduledDate);
        delayMs = Math.max(0, scheduledTime.getTime() - now.getTime());
      }

      const emailResults = await enqueueDocumentNewsletter({
        env: ctx.env,
        document,
        writerSettings,
        recipients,
        options: {
          delayMs,
          priority: sendImmediately ? 9 : 5,
        },
      });

      return {
        success: true,
        message:
          delayMs > 0
            ? `Scheduled ${emailResults.length} emails for ${document.scheduledDate}`
            : `Enqueued ${emailResults.length} emails for immediate delivery`,
        count: emailResults.length,
        scheduledFor: document.scheduledDate,
        jobIds: emailResults.map((r) => r.jobId),
      };
    }),
});
