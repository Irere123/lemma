import { and, eq, isNull, sql } from 'drizzle-orm'
import { GraphQLError } from 'graphql'

import {
  createComment,
  deleteComment,
  getCommentById,
  getCommentReplies,
  getCommentWithAuthor,
  getDocumentById,
  getDocumentComments,
  updateComment,
} from '@api/db/queries'
import { comments } from '@api/db/schema'
import type { CommentWithAuthor } from '@api/schemas'
import type { GraphQLContext } from '../context'
import { requireAuth, requireScope } from '../context'
import {
  buildConnection,
  type Connection,
  type ConnectionArgs,
  decodeCursor,
  getLimit,
} from '../pagination'

type CreateCommentInput = {
  documentId: string
  parentId?: string | null
  content: string
}

type UpdateCommentInput = {
  id: string
  content: string
}

async function getCommentsTotalCount(
  db: any,
  documentId: string,
  parentId?: string | null
): Promise<number> {
  const filters = [eq(comments.documentId, documentId)]

  if (parentId) {
    filters.push(eq(comments.parentId, parentId))
  } else {
    filters.push(isNull(comments.parentId))
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(and(...filters))

  return result[0]?.count ?? 0
}

export const commentResolvers = {
  Query: {
    comments: async (
      _: unknown,
      args: { documentId: string; parentId?: string | null; pagination?: ConnectionArgs },
      context: GraphQLContext
    ): Promise<Connection<CommentWithAuthor>> => {
      const { db } = context
      const limit = getLimit(args.pagination ?? {})
      const cursor = args.pagination?.after ? decodeCursor(args.pagination.after) : undefined

      const commentsList = await getDocumentComments(db, {
        documentId: args.documentId,
        parentId: args.parentId ?? undefined,
        limit: limit + 1,
        cursor,
      })

      const totalCount = await getCommentsTotalCount(db, args.documentId, args.parentId)

      // `Comment.replyCount` is resolved lazily and batched per-request via the
      // DataLoader, so we don't eagerly compute it here (avoids N+1).
      return buildConnection(
        commentsList as any,
        args.pagination ?? {},
        totalCount,
        (c: any) => c.createdAt?.toISOString() ?? c.id
      )
    },

    comment: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext
    ): Promise<CommentWithAuthor | null> => {
      const comment = await getCommentWithAuthor(context.db, args.id)
      return comment ?? null
    },
  },

  Mutation: {
    createComment: async (
      _: unknown,
      args: { input: CreateCommentInput },
      context: GraphQLContext
    ): Promise<CommentWithAuthor> => {
      requireAuth(context)
      requireScope(context, 'comments.write')

      const { db, session } = context
      const { documentId, parentId, content } = args.input

      const document = await getDocumentById(db, documentId)
      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      if (parentId) {
        const parent = await getCommentById(db, parentId)
        if (!parent) {
          throw new GraphQLError('Parent comment not found', {
            extensions: { code: 'NOT_FOUND' },
          })
        }
        if (parent.documentId !== documentId) {
          throw new GraphQLError('Parent comment does not belong to this document', {
            extensions: { code: 'BAD_REQUEST' },
          })
        }
      }

      const comment = await createComment(
        db,
        { documentId, parentId: parentId ?? undefined, content },
        session!.user.id
      )

      const commentWithAuthor = await getCommentWithAuthor(db, comment.id)

      if (!commentWithAuthor) {
        throw new GraphQLError('Failed to create comment', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        })
      }

      return commentWithAuthor
    },

    updateComment: async (
      _: unknown,
      args: { input: UpdateCommentInput },
      context: GraphQLContext
    ): Promise<CommentWithAuthor> => {
      requireAuth(context)
      requireScope(context, 'comments.write')

      const { db, session } = context
      const { id, content } = args.input

      const comment = await updateComment(db, id, session!.user.id, content)

      if (!comment) {
        throw new GraphQLError('Comment not found or not authorized', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      const commentWithAuthor = await getCommentWithAuthor(db, comment.id)

      if (!commentWithAuthor) {
        throw new GraphQLError('Failed to update comment', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        })
      }

      return commentWithAuthor
    },

    deleteComment: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      requireAuth(context)
      requireScope(context, 'comments.write')

      const { db, session } = context

      const deleted = await deleteComment(db, args.id, session!.user.id)

      if (!deleted) {
        throw new GraphQLError('Comment not found or not authorized', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      return true
    },
  },

  Comment: {
    author: (parent: CommentWithAuthor) => {
      return parent.author
    },

    replyCount: async (parent: CommentWithAuthor, _: unknown, context: GraphQLContext) => {
      // If already computed, return it
      if (parent.replyCount !== undefined) {
        return parent.replyCount
      }
      // Only compute for top-level comments
      if (parent.parentId) {
        return null
      }
      // Batched per-request to avoid N+1 across a list of comments.
      return context.loaders.replyCount.load(parent.id)
    },

    replies: async (
      parent: CommentWithAuthor,
      args: { pagination?: ConnectionArgs },
      context: GraphQLContext
    ): Promise<Connection<CommentWithAuthor>> => {
      const { db } = context
      const limit = getLimit(args.pagination ?? {})
      const cursor = args.pagination?.after ? decodeCursor(args.pagination.after) : undefined

      const replies = await getCommentReplies(db, parent.id, {
        limit: limit + 1,
        cursor,
      })

      const totalCount = await getCommentsTotalCount(db, parent.documentId, parent.id)

      return buildConnection(
        replies as any,
        args.pagination ?? {},
        totalCount,
        (c: any) => c.createdAt?.toISOString() ?? c.id
      )
    },
  },
}
