import {
  documentByIdSchema,
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

  getUserDocuments: protectedProcedure.query(async ({ ctx }) => {
    return await getUserDocuments(ctx.db, ctx.user.id);
  }),
});
