import { upsertDocumentSchema } from "@api/schemas/documents";
import { createTRPCRouter, protectedProcedure } from "../init";
import { upsertDocument } from "@api/db/queries";

export const documentRouter = createTRPCRouter({
  upsertDocument: protectedProcedure
    .input(upsertDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      const document = await upsertDocument(ctx.db, input);

      if (document) {
        return document;
      }
      return {};
    }),
});
