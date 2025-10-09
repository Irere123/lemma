import { TRPCError } from "@trpc/server";
import {
  documentByIdSchema,
  documentsFilters,
  upsertDocumentSchema,
  sendNewsletterSchema,
  deleteDocumentSchema,
} from "@api/schemas/documents";
import {
  getAdminPublishedArticles,
  getDocumentById,
  getUserDocuments,
  upsertDocument,
  deleteDocument,
} from "@api/db/queries";
import { getConfirmedSubscribers } from "@api/db/queries/subscribers";
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
        ? (results.at(-1)?.createdAt?.toISOString() ?? null)
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

      // Get the document
      const document = await getDocumentById(ctx.db, documentId);

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Check if user owns the document
      if (document.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to send this document",
        });
      }

      // Get confirmed subscribers
      const subscribers = await getConfirmedSubscribers(ctx.db);

      if (subscribers.length === 0) {
        return {
          success: true,
          message: "No confirmed subscribers found",
          count: 0,
        };
      }

      // Prepare recipients
      const recipients = subscribers.map((sub) => ({
        email: sub.email,
        unsubscribeToken: sub.token,
      }));

      // Calculate delay based on scheduled date
      let delayMs = 0;
      if (!sendImmediately && document.scheduledDate) {
        const now = new Date();
        const scheduledTime = new Date(document.scheduledDate);
        delayMs = Math.max(0, scheduledTime.getTime() - now.getTime());
      }

      // Enqueue emails with optional delay
      const emailResults = await enqueueDocumentNewsletter(
        ctx.env,
        {
          id: document.id,
          title: document.title,
          subtitle: document.subtitle,
          markdown: document.markdown,
          bannerImage: document.bannerImage,
          publishedDate: document.publishedDate,
        },
        recipients,
        {
          delayMs,
          priority: sendImmediately ? 9 : 5,
        }
      );

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
