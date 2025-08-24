import z from "zod";

import { documentStatusEnum, documentTypeEnum } from "@api/db/schema";

export const upsertDocumentSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  subtitle: z.string(),
  status: z.enum(documentStatusEnum.enumValues).default("DRAFT"),
  type: z.enum(documentTypeEnum.enumValues).default("ARTICLE"),
  content: z.any(),
});
