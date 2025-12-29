import { createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import { createRouter } from '@api/lib/utils'
import { getLikeStatus, toggleLike, getDocumentById, getDocumentLikeCount } from '@api/db/queries'
import { toggleLikeSchema, toggleLikeResponseSchema, likeStatusResponseSchema } from '@api/schemas'
import { withRequiredScope } from '@api/rest/middleware'
import { withAuth } from '@api/rest/middleware/auth'
import { validateResponse } from '@api/lib/validate-response'

const likesRouter = createRouter()

// GET /likes/status - Get like status for a document (public)
likesRouter.openapi(
  createRoute({
    method: 'get',
    tags: ['Likes'],
    path: '/status',
    summary: 'Get like status for a document',
    request: {
      query: z.object({ documentId: z.string() }),
    },
    responses: {
      200: {
        description: 'Like status with count',
        content: {
          'application/json': {
            schema: likeStatusResponseSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const { documentId } = c.req.valid('query')

    // For public endpoint, we can only return the count
    // isLiked is always false for unauthenticated users
    const likeCount = await getDocumentLikeCount(db, documentId)
    return c.json(validateResponse({ isLiked: false, likeCount }, likeStatusResponseSchema))
  }
)

// GET /likes/status/me - Get like status for authenticated user (protected)
likesRouter.openapi(
  createRoute({
    method: 'get',
    tags: ['Likes'],
    path: '/status/me',
    summary: 'Get like status for authenticated user',
    request: {
      query: z.object({ documentId: z.string() }),
    },
    responses: {
      200: {
        description: 'Like status with count for authenticated user',
        content: {
          'application/json': {
            schema: likeStatusResponseSchema,
          },
        },
      },
    },
    middleware: [withAuth, withRequiredScope('likes.read')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { documentId } = c.req.valid('query')

    const status = await getLikeStatus(db, documentId, session.user.id)
    return c.json(validateResponse(status, likeStatusResponseSchema))
  }
)

// POST /likes/toggle - Toggle like on a document (protected)
likesRouter.openapi(
  createRoute({
    method: 'post',
    tags: ['Likes'],
    path: '/toggle',
    summary: 'Toggle like on a document',
    request: {
      body: {
        content: {
          'application/json': {
            schema: toggleLikeSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'New like state',
        content: {
          'application/json': {
            schema: toggleLikeResponseSchema,
          },
        },
      },
    },
    middleware: [withAuth, withRequiredScope('likes.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { documentId } = c.req.valid('json')

    // Verify document exists
    const document = await getDocumentById(db, documentId)
    if (!document) {
      throw new HTTPException(404, { message: 'Document not found' })
    }

    const result = await toggleLike(db, documentId, session.user.id)
    return c.json(validateResponse(result, toggleLikeResponseSchema))
  }
)

export { likesRouter }
