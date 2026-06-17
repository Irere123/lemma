import { z } from '@hono/zod-openapi'

export const userProfileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi('UserProfile')
