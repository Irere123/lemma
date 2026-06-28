import { z } from '@hono/zod-openapi'

export const commentSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  userId: z.string(),
  parentId: z.string().nullable(),
  content: z.string(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
})

export const createCommentSchema = z.object({
  documentId: z.string(),
  parentId: z.string().optional(),
  content: z.string().min(1).max(10000),
})

export const updateCommentSchema = z.object({
  id: z.string(),
  content: z.string().min(1).max(10000),
})

export const deleteCommentSchema = z.object({
  id: z.string(),
})

export const getCommentsSchema = z.object({
  documentId: z.string(),
  parentId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
})

export const getCommentRepliesSchema = z.object({
  commentId: z.string(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
})

export const authorSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
})

export const commentWithAuthorSchema = commentSchema.extend({
  author: authorSchema,
  replyCount: z.number().optional(),
})

export const commentsResponseSchema = z.object({
  data: z.array(commentWithAuthorSchema),
  nextCursor: z.string().nullable(),
})

export const commentResponseSchema = z.object({
  data: commentWithAuthorSchema,
})

export type CreateCommentData = z.infer<typeof createCommentSchema>
export type UpdateCommentData = z.infer<typeof updateCommentSchema>
export type GetCommentsData = z.infer<typeof getCommentsSchema>
export type CommentWithAuthor = z.infer<typeof commentWithAuthorSchema>
