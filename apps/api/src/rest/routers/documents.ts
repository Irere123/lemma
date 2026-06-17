import { createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import {
  deleteDocument,
  getUserDocumentById,
  getUserDocuments,
  updateDocumentBannerImage,
  upsertDocument,
} from '@api/db/queries'
import { createRouter } from '@api/lib/utils'
import { validateResponse } from '@api/lib/validate-response'
import { withRequiredScope } from '@api/rest/middleware'
import {
  documentSchema,
  documentsFilters,
  documentsResponseSchema,
  errorResponses,
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
    security: [{ token: [] }],
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
      ...errorResponses(400, 401, 403, 429),
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
    security: [{ token: [] }],
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
      ...errorResponses(400, 401, 403, 429),
    },
    middleware: [withRequiredScope('documents.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const input = c.req.valid('json')

    const result = await upsertDocument(db, input, session.user.id)

    if (!result) {
      throw new HTTPException(500, { message: 'Failed to save document' })
    }

    return c.json(validateResponse({ data: result }, upsertDocumentResponseSchema))
  }
)

documentsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/:id/banner',
    tags: ['Documents'],
    summary: 'Update the banner image of a document',
    security: [{ token: [] }],
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
      ...errorResponses(400, 401, 403, 404, 429),
    },
    middleware: [withRequiredScope('documents.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')
    const { bannerImage } = c.req.valid('json')

    const updated = await updateDocumentBannerImage(db, id, session.user.id, bannerImage ?? null)

    if (!updated) {
      throw new HTTPException(404, { message: 'Document not found' })
    }

    return c.json(validateResponse({ data: updated }, upsertDocumentResponseSchema))
  }
)

documentsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/:id',
    tags: ['Documents'],
    summary: 'Get one of your documents by ID',
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: {
        description: 'The requested document',
        content: {
          'application/json': {
            schema: documentSchema,
          },
        },
      },
      ...errorResponses(401, 403, 404, 429),
    },
    middleware: [withRequiredScope('documents.read')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')

    const document = await getUserDocumentById(db, id, session.user.id)

    if (!document) {
      throw new HTTPException(404, { message: 'Document not found' })
    }

    return c.json(validateResponse(document, documentSchema))
  }
)

documentsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Documents'],
    summary: 'Delete one of your documents',
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: {
        description: 'Document deleted',
        content: {
          'application/json': {
            schema: z.object({ success: z.boolean() }),
          },
        },
      },
      ...errorResponses(401, 403, 404, 429),
    },
    middleware: [withRequiredScope('documents.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')

    const deleted = await deleteDocument(db, id, session.user.id)

    if (!deleted) {
      throw new HTTPException(404, { message: 'Document not found' })
    }

    return c.json({ success: true })
  }
)

export { documentsRouter }
