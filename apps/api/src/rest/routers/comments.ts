import { createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import {
  createComment,
  deleteComment,
  getCommentById,
  getCommentReplies,
  getCommentWithAuthor,
  getDocumentById,
  getDocumentComments,
  getReplyCount,
  updateComment,
} from '@api/db/queries'
import { createRouter } from '@api/lib/utils'
import { validateResponse } from '@api/lib/validate-response'
import { withRequiredScope } from '@api/rest/middleware'
import { withAuth } from '@api/rest/middleware/auth'
import {
  commentResponseSchema,
  commentsResponseSchema,
  createCommentSchema,
  errorResponses,
  getCommentsSchema,
} from '@api/schemas'

const commentsRouter = createRouter()

// GET /comments - List comments for a document (public)
commentsRouter.openapi(
  createRoute({
    method: 'get',
    tags: ['Comments'],
    path: '/',
    summary: 'List comments for a document',
    request: {
      query: getCommentsSchema,
    },
    responses: {
      200: {
        description: 'List of comments with pagination',
        content: {
          'application/json': {
            schema: commentsResponseSchema,
          },
        },
      },
      ...errorResponses(400, 429),
    },
  }),
  async (c) => {
    const db = c.get('db')
    const filters = c.req.valid('query')

    const comments = await getDocumentComments(db, filters)

    const hasMore = comments.length > filters.limit
    const results = hasMore ? comments.slice(0, filters.limit) : comments

    // Fetch reply counts for top-level comments
    const commentsWithReplyCounts = await Promise.all(
      results.map(async (comment) => ({
        ...comment,
        replyCount: comment.parentId ? undefined : await getReplyCount(db, comment.id),
      }))
    )

    const nextCursor = hasMore ? (results.at(-1)?.createdAt?.toISOString() ?? null) : null

    return c.json(
      validateResponse({ data: commentsWithReplyCounts, nextCursor }, commentsResponseSchema)
    )
  }
)

// GET /comments/:id/replies - Get replies for a comment (public)
commentsRouter.openapi(
  createRoute({
    method: 'get',
    tags: ['Comments'],
    path: '/:id/replies',
    summary: 'Get replies for a comment',
    request: {
      params: z.object({ id: z.string() }),
      query: z.object({
        limit: z.coerce.number().min(1).max(100).optional().default(20),
        cursor: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'List of replies with pagination',
        content: {
          'application/json': {
            schema: commentsResponseSchema,
          },
        },
      },
      ...errorResponses(400, 429),
    },
  }),
  async (c) => {
    const db = c.get('db')
    const { id } = c.req.valid('param')
    const { limit, cursor } = c.req.valid('query')

    const replies = await getCommentReplies(db, id, { limit, cursor })

    const hasMore = replies.length > limit
    const results = hasMore ? replies.slice(0, limit) : replies

    const nextCursor = hasMore ? (results.at(-1)?.createdAt?.toISOString() ?? null) : null

    return c.json(validateResponse({ data: results, nextCursor }, commentsResponseSchema))
  }
)

// POST /comments - Create a new comment (protected)
commentsRouter.openapi(
  createRoute({
    method: 'post',
    tags: ['Comments'],
    path: '/',
    summary: 'Create a new comment',
    security: [{ token: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: createCommentSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Created comment',
        content: {
          'application/json': {
            schema: commentResponseSchema,
          },
        },
      },
      ...errorResponses(400, 401, 403, 404, 429),
    },
    middleware: [withAuth, withRequiredScope('comments.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const input = c.req.valid('json')

    // Verify document exists
    const document = await getDocumentById(db, input.documentId)
    if (!document) {
      throw new HTTPException(404, { message: 'Document not found' })
    }

    // If replying, verify parent exists
    if (input.parentId) {
      const parent = await getCommentById(db, input.parentId)
      if (!parent) {
        throw new HTTPException(404, { message: 'Parent comment not found' })
      }
      if (parent.documentId !== input.documentId) {
        throw new HTTPException(400, { message: 'Parent comment does not belong to this document' })
      }
    }

    const comment = await createComment(db, input, session.user.id)
    const commentWithAuthor = await getCommentWithAuthor(db, comment.id)

    return c.json(validateResponse({ data: commentWithAuthor }, commentResponseSchema), 201)
  }
)

// PATCH /comments/:id - Update a comment (protected)
commentsRouter.openapi(
  createRoute({
    method: 'patch',
    tags: ['Comments'],
    path: '/:id',
    summary: 'Update a comment',
    security: [{ token: [] }],
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          'application/json': {
            schema: z.object({ content: z.string().min(1).max(10000) }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Updated comment',
        content: {
          'application/json': {
            schema: commentResponseSchema,
          },
        },
      },
      ...errorResponses(400, 401, 403, 404, 429),
    },
    middleware: [withAuth, withRequiredScope('comments.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')
    const { content } = c.req.valid('json')

    const comment = await updateComment(db, id, session.user.id, content)

    if (!comment) {
      throw new HTTPException(404, { message: 'Comment not found or not authorized' })
    }

    const commentWithAuthor = await getCommentWithAuthor(db, comment.id)

    return c.json(validateResponse({ data: commentWithAuthor }, commentResponseSchema))
  }
)

// DELETE /comments/:id - Delete a comment (protected)
commentsRouter.openapi(
  createRoute({
    method: 'delete',
    tags: ['Comments'],
    path: '/:id',
    summary: 'Delete a comment',
    security: [{ token: [] }],
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: {
        description: 'Deletion result',
        content: {
          'application/json': {
            schema: z.object({ success: z.boolean() }),
          },
        },
      },
      ...errorResponses(401, 403, 404, 429),
    },
    middleware: [withAuth, withRequiredScope('comments.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')

    const deleted = await deleteComment(db, id, session.user.id)

    if (!deleted) {
      throw new HTTPException(404, { message: 'Comment not found or not authorized' })
    }

    return c.json({ success: true })
  }
)

export { commentsRouter }
