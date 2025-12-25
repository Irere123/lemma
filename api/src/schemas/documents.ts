import { z } from '@hono/zod-openapi'

import { documentStatusEnum } from '@api/db/schema'

// Request

export const documentSchema = z.object({
  id: z.string(),
  slug: z.string().nullable().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional().nullable(),
  status: z.enum(documentStatusEnum.enumValues).default('DRAFT'),
  content: z.any(),
  markdown: z.string().nullable().optional(),
  bannerImage: z.string().nullable().optional(),
  scheduledDate: z.date().nullable().optional(),
  publishedDate: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const upsertDocumentSchema = z.object({
  id: z.string().optional(),
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  status: z.enum(documentStatusEnum.enumValues).optional().default('DRAFT'),
  content: z.any().optional(),
  markdown: z.string().nullable().optional(),
  bannerImage: z.string().nullable().optional(),
  scheduledDate: z.coerce.date().nullable().optional(),
  publishedDate: z.coerce.date().nullable().optional(),
})

export const deleteDocumentSchema = z.object({
  id: z.string(),
})

export const documentsFilters = z.object({
  status: z.enum(documentStatusEnum.enumValues).optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
})

export const documentByIdSchema = z.object({
  id: z.string(),
})

// Responses

export const upsertDocumentResponseSchema = z.object({
  data: documentSchema,
})

export const updateBannerImageSchema = z.object({
  documentId: z.string().optional(),
  bannerImage: z.string(),
})

// Lightweight document schema without heavy content fields
export const documentListItemSchema = documentSchema.omit({
  content: true,
})

export const documentsResponseSchema = z.object({
  nextCursor: z.nullable(z.string()),
  data: z.array(documentListItemSchema).optional().default([]),
})

export const documentResponseSchema = z.object({
  data: z.any(),
})

export const sendNewsletterSchema = z.object({
  documentId: z.string(),
  sendImmediately: z.boolean().default(false),
})

export const sendNewsletterResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  count: z.number(),
  scheduledFor: z.string().nullable(),
  scheduleMode: z.enum(['immediate', 'scheduled', 'past']),
  jobIds: z.array(z.string()),
})

export type UpsertDocumentData = z.infer<typeof upsertDocumentSchema>
export type SendNewsletterData = z.infer<typeof sendNewsletterSchema>
export type SendNewsletterResponse = z.infer<typeof sendNewsletterResponseSchema>
