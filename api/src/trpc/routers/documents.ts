import {
  documentByIdSchema,
  documentsFilters,
  upsertDocumentSchema,
} from "@api/schemas/documents";
import {
  getAdminPublishedArticles,
  getDocumentById,
  getUserDocuments,
  upsertDocument,
} from "@api/db/queries";
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
});
