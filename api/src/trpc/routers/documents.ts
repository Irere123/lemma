import { upsertDocumentSchema } from "@api/schemas/documents";
import { createTRPCRouter, protectedProcedure } from "../init";
import { getUserDocuments, upsertDocument } from "@api/db/queries";

export const documentRouter = createTRPCRouter({
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
