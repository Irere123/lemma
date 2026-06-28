import { createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import type { DB } from '@api/db'
import { createTag, deleteTag, getTagById, getTagsByWriter } from '@api/db/queries'
import { createRouter } from '@api/lib/utils'
import { validateResponse } from '@api/lib/validate-response'
import { withRequiredScope } from '@api/rest/middleware'
import {
  createTagSchema,
  errorResponses,
  tagResponseSchema,
  tagsResponseSchema,
} from '@api/schemas'

const tagsRouter = createRouter()

// Fetch a tag and assert the caller owns it, or throw 404.
async function getOwnedTag(db: DB, id: string, userId: string) {
  const tag = await getTagById(db, id)
  if (!tag || tag.writerId !== userId) {
    throw new HTTPException(404, { message: 'Tag not found' })
  }
  return tag
}

tagsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Tags'],
    summary: 'List your tags',
    security: [{ token: [] }],
    responses: {
      200: {
        description: 'A list of tags',
        content: { 'application/json': { schema: tagsResponseSchema } },
      },
      ...errorResponses(401, 403, 429),
    },
    middleware: [withRequiredScope('tags.read')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')

    const tags = await getTagsByWriter(db, session.user.id)

    return c.json(validateResponse({ data: tags }, tagsResponseSchema))
  }
)

tagsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/',
    tags: ['Tags'],
    summary: 'Create a tag',
    security: [{ token: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: createTagSchema } },
      },
    },
    responses: {
      201: {
        description: 'Tag created',
        content: { 'application/json': { schema: tagResponseSchema } },
      },
      ...errorResponses(400, 401, 403, 429),
    },
    middleware: [withRequiredScope('tags.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const input = c.req.valid('json')

    const tag = await createTag(db, {
      name: input.name,
      writerId: session.user.id,
    })

    return c.json(validateResponse({ data: tag }, tagResponseSchema), 201)
  }
)

tagsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/:id',
    tags: ['Tags'],
    summary: 'Get a tag by ID',
    security: [{ token: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: 'Tag details',
        content: { 'application/json': { schema: tagResponseSchema } },
      },
      ...errorResponses(401, 403, 404, 429),
    },
    middleware: [withRequiredScope('tags.read')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')

    const tag = await getOwnedTag(db, id, session.user.id)

    return c.json(validateResponse({ data: tag }, tagResponseSchema))
  }
)

tagsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Tags'],
    summary: 'Delete a tag',
    security: [{ token: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: {
        description: 'Tag deleted',
        content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
      },
      ...errorResponses(401, 403, 404, 429),
    },
    middleware: [withRequiredScope('tags.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')

    await getOwnedTag(db, id, session.user.id)

    await deleteTag(db, id)

    return c.json({ success: true })
  }
)

export { tagsRouter }
