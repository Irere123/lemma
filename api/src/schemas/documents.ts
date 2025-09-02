import { z } from "@hono/zod-openapi";

import { documentStatusEnum, documentTypeEnum } from "@api/db/schema";

export const upsertDocumentSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  status: z.enum(documentStatusEnum.enumValues).default("DRAFT"),
  type: z.enum(documentTypeEnum.enumValues).default("ARTICLE"),
  content: z.any(),
});

export type UpsertDocumentData = z.infer<typeof upsertDocumentSchema>;
