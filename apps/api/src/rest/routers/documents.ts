import { createRoute, z } from '@hono/zod-openapi'

import { getUserDocuments, updateDocumentBannerImage, upsertDocument } from '@api/db/queries'
import { createRouter } from '@api/lib/utils'
import { validateResponse } from '@api/lib/validate-response'
import { withRequiredScope } from '@api/rest/middleware'
import {
  documentsFilters,
  documentsResponseSchema,
  updateBannerImageSchema,
  upsertDocumentResponseSchema,
  upsertDocumentSchema,
} from '@api/schemas'

const documentsRouter = createRouter()

documentsRouter.openapi(
  createRoute({
    method: 'get',
    tags: ['Documents'],
    path: '/',
    summary: 'List all user documents',
    request: {
      query: documentsFilters,
    },
    responses: {
      200: {
        description: 'Retrieve all user related blog, articles, and notes documents',
        content: {
          'application/json': {
            schema: documentsResponseSchema,
          },
        },
      },
    },
    middleware: [withRequiredScope('documents.read')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const filters = c.req.valid('query')

    const userDocuments = await getUserDocuments(db, {
      ...filters,
      userId: session.user.id,
    })

    // Check if there are more results
    const hasMore = userDocuments.length > filters.limit
    const results = hasMore ? userDocuments.slice(0, filters.limit) : userDocuments
    const nextCursor = hasMore ? (results.at(-1)?.createdAt?.toISOString() ?? null) : null

    return c.json(validateResponse({ nextCursor, data: results }, documentsResponseSchema))
  }
)

documentsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/',
    tags: ['Documents'],
    summary: 'Create/Update a document',
    request: {
      body: {
        content: {
          'application/json': {
            schema: upsertDocumentSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Created/Updated document',
        content: {
          'application/json': {
            schema: upsertDocumentResponseSchema,
          },
        },
      },
    },
    middleware: [withRequiredScope('documents.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const input = c.req.valid('json')

    const result = await upsertDocument(db, input, session.user.id)

    return c.json(validateResponse(result, upsertDocumentResponseSchema))
  }
)

documentsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/:id/banner',
    tags: ['Documents'],
    summary: 'Update the banner image of a document',
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          'application/json': {
            schema: updateBannerImageSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated document',
        content: {
          'application/json': {
            schema: upsertDocumentResponseSchema,
          },
        },
      },
    },
    middleware: [withRequiredScope('documents.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')
    const { bannerImage } = c.req.valid('json')

    const updated = await updateDocumentBannerImage(db, id, session.user.id, bannerImage ?? null)

    return c.json(validateResponse({ data: updated }, upsertDocumentResponseSchema))
  }
)

export { documentsRouter }
