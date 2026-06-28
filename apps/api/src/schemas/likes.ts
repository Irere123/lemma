import { z } from '@hono/zod-openapi'

export const likeSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  userId: z.string(),
  createdAt: z.date().nullable(),
})

export const toggleLikeSchema = z.object({
  documentId: z.string(),
})

export const getLikeStatusSchema = z.object({
  documentId: z.string(),
})

export const toggleLikeResponseSchema = z.object({
  liked: z.boolean(),
  likeCount: z.number(),
})

export const likeStatusResponseSchema = z.object({
  isLiked: z.boolean(),
  likeCount: z.number(),
})

export type ToggleLikeData = z.infer<typeof toggleLikeSchema>
export type ToggleLikeResponse = z.infer<typeof toggleLikeResponseSchema>
export type LikeStatusResponse = z.infer<typeof likeStatusResponseSchema>
