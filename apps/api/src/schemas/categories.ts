import { z } from '@hono/zod-openapi'

export const categorySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    color: z.string().nullable(),
    writerId: z.string(),
    parentId: z.string().nullable(),
    createdAt: z.date().nullable(),
    updatedAt: z.date().nullable(),
  })
  .openapi('Category')

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().max(32).optional(),
  parentId: z.string().optional(),
})

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(32).optional(),
  parentId: z.string().nullable().optional(),
})

export const categoriesResponseSchema = z.object({
  data: z.array(categorySchema),
})

export const categoryResponseSchema = z.object({
  data: categorySchema,
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
