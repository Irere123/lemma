import { createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import {
  getPublishedArticleBySlug,
  getPublishedArticles,
  getPublishedDocumentById,
} from '@api/db/queries'
import { createRouter } from '@api/lib/utils'
import { validateResponse } from '@api/lib/validate-response'
import { documentSchema, documentsResponseSchema, errorResponses } from '@api/schemas'

const postsRouter = createRouter()

// List published posts (optionally scoped to a single writer)
postsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Posts'],
    summary: 'List published posts',
    request: {
      query: z.object({
        writerId: z.string().optional(),
        limit: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'A list of published posts',
        content: {
          'application/json': {
            schema: documentsResponseSchema,
          },
        },
      },
      ...errorResponses(400, 429),
    },
  }),
  async (c) => {
    const db = c.get('db')
    const query = c.req.valid('query')

    const articles = await getPublishedArticles(db, {
      writerId: query.writerId,
      limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
    })

    return c.json(validateResponse({ nextCursor: null, data: articles }, documentsResponseSchema))
  }
)

postsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/:id',
    tags: ['Posts'],
    summary: 'Get a published post by ID',
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Retrieve a published post by ID',
        content: {
          'application/json': {
            schema: documentSchema,
          },
        },
      },
      ...errorResponses(404, 429),
    },
  }),
  async (c) => {
    const db = c.get('db')
    const { id } = c.req.valid('param')

    const document = await getPublishedDocumentById(db, id)

    if (!document) {
      throw new HTTPException(404, { message: 'Post not found' })
    }

    return c.json(validateResponse(document, documentSchema))
  }
)

postsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/slug/:slug',
    tags: ['Posts'],
    summary: 'Get a published post by slug',
    request: {
      params: z.object({
        slug: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Retrieve a published post by slug',
        content: {
          'application/json': {
            schema: documentSchema,
          },
        },
      },
      ...errorResponses(404, 429),
    },
  }),
  async (c) => {
    const db = c.get('db')
    const { slug } = c.req.valid('param')

    const document = await getPublishedArticleBySlug(db, slug)

    if (!document) {
      throw new HTTPException(404, { message: 'Post not found' })
    }

    return c.json(validateResponse(document, documentSchema))
  }
)

export { postsRouter }
