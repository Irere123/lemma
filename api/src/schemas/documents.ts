import { z } from "@hono/zod-openapi";

import { documentStatusEnum, documentTypeEnum } from "@api/db/schema";

// Request

export const upsertDocumentSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  status: z.enum(documentStatusEnum.enumValues).default("DRAFT"),
  type: z.enum(documentTypeEnum.enumValues).default("ARTICLE"),
  content: z.any(),
});

export const documentsFilters = z.object({
  type: z.enum(documentTypeEnum.enumValues).optional(),
  status: z.enum(documentStatusEnum.enumValues).optional(),
});

export const documentByIdSchema = z.object({
  id: z.string(),
});

// Responses

export const upsertDocumentResponseSchema = z.object({
  data: z.any(),
});

export const documentsResponseSchema = z.object({
  nextCursor: z.nullable(z.string()),
  data: z.array(z.any()),
});

export const documentResponseSchema = z.object({
  data: z.any(),
});

export type UpsertDocumentData = z.infer<typeof upsertDocumentSchema>;
