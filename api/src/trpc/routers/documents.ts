import { z } from "zod";

import { upsertDocumentSchema } from "@api/schemas/documents";
import { getUserDocuments, upsertDocument } from "@api/db/queries";
import { documentStatusEnum, documentTypeEnum } from "@api/db/schema";
import { createTRPCRouter, protectedProcedure } from "../init";

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
  updateDocumentStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(documentStatusEnum.enumValues),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const document = await upsertDocument(
        ctx.db,
        {
          id: input.id,
          status: input.status,
          type: "ARTICLE",
        },
        ctx.user.id
      );
      return document;
    }),
  updateDocumentType: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        type: z.enum(documentTypeEnum.enumValues),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const document = await upsertDocument(
        ctx.db,
        {
          id: input.id,
          type: input.type,
          status: "DRAFT",
        },
        ctx.user.id
      );
      return document;
    }),
});
