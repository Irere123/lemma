import { createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import type { DB } from '@api/db'
import {
  createCategory,
  deleteCategory,
  getCategoriesByWriter,
  getCategoryById,
  updateCategory,
} from '@api/db/queries'
import { createRouter } from '@api/lib/utils'
import { validateResponse } from '@api/lib/validate-response'
import { withRequiredScope } from '@api/rest/middleware'
import {
  categoriesResponseSchema,
  categoryResponseSchema,
  createCategorySchema,
  errorResponses,
  updateCategorySchema,
} from '@api/schemas'

const categoriesRouter = createRouter()

// Fetch a category and assert the caller owns it, or throw 404.
async function getOwnedCategory(db: DB, id: string, userId: string) {
  const category = await getCategoryById(db, id)
  if (!category || category.writerId !== userId) {
    throw new HTTPException(404, { message: 'Category not found' })
  }
  return category
}

// List categories
categoriesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Categories'],
    summary: 'List your categories',
    security: [{ token: [] }],
    responses: {
      200: {
        description: 'A list of categories',
        content: { 'application/json': { schema: categoriesResponseSchema } },
      },
      ...errorResponses(401, 403, 429),
    },
    middleware: [withRequiredScope('categories.read')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')

    const categories = await getCategoriesByWriter(db, session.user.id)

    return c.json(validateResponse({ data: categories }, categoriesResponseSchema))
  }
)

// Create category
categoriesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/',
    tags: ['Categories'],
    summary: 'Create a category',
    security: [{ token: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: createCategorySchema } },
      },
    },
    responses: {
      201: {
        description: 'Category created',
        content: { 'application/json': { schema: categoryResponseSchema } },
      },
      ...errorResponses(400, 401, 403, 429),
    },
    middleware: [withRequiredScope('categories.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const input = c.req.valid('json')

    const category = await createCategory(db, {
      ...input,
      writerId: session.user.id,
    })

    return c.json(validateResponse({ data: category }, categoryResponseSchema), 201)
  }
)

// Get category by ID
categoriesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/:id',
    tags: ['Categories'],
    summary: 'Get a category by ID',
    security: [{ token: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: 'Category details',
        content: { 'application/json': { schema: categoryResponseSchema } },
      },
      ...errorResponses(401, 403, 404, 429),
    },
    middleware: [withRequiredScope('categories.read')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')

    const category = await getOwnedCategory(db, id, session.user.id)

    return c.json(validateResponse({ data: category }, categoryResponseSchema))
  }
)

// Update category
categoriesRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/:id',
    tags: ['Categories'],
    summary: 'Update a category',
    security: [{ token: [] }],
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: { 'application/json': { schema: updateCategorySchema } },
      },
    },
    responses: {
      200: {
        description: 'Category updated',
        content: { 'application/json': { schema: categoryResponseSchema } },
      },
      ...errorResponses(400, 401, 403, 404, 429),
    },
    middleware: [withRequiredScope('categories.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')

    await getOwnedCategory(db, id, session.user.id)

    const category = await updateCategory(db, { id, ...input })

    if (!category) {
      throw new HTTPException(404, { message: 'Category not found' })
    }

    return c.json(validateResponse({ data: category }, categoryResponseSchema))
  }
)

// Delete category
categoriesRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Categories'],
    summary: 'Delete a category',
    security: [{ token: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: 'Category deleted',
        content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
      },
      ...errorResponses(401, 403, 404, 429),
    },
    middleware: [withRequiredScope('categories.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')

    await getOwnedCategory(db, id, session.user.id)

    await deleteCategory(db, id)

    return c.json({ success: true })
  }
)

export { categoriesRouter }
