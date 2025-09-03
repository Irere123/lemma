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
      return await getUserDocuments(db, { ...input, userId: user.id });
    }),
});
