import { z } from '@hono/zod-openapi'

export const tagSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    writerId: z.string(),
    usageCount: z.string().nullable(),
    createdAt: z.date().nullable(),
  })
  .openapi('Tag')

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
})

export const tagsResponseSchema = z.object({
  data: z.array(tagSchema),
})

export const tagResponseSchema = z.object({
  data: tagSchema,
})

export type CreateTagInput = z.infer<typeof createTagSchema>
