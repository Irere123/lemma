import { z } from '@hono/zod-openapi'

export const followUserSchema = z.object({
  // The user being followed/unfollowed.
  userId: z.string(),
})

export const followStatusSchema = z.object({
  userId: z.string(),
})

export const followListSchema = z.object({
  // Whose followers / following list to page through.
  userId: z.string(),
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
})

export type FollowUserData = z.infer<typeof followUserSchema>
