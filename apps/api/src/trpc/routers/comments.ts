import { TRPCError } from '@trpc/server'

import {
  createComment,
  deleteComment,
  getCommentById,
  getCommentWithAuthor,
  getDocumentComments,
  getCommentReplies,
  getReplyCount,
  updateComment,
  getDocumentById,
} from '@api/db/queries'
import {
  createCommentSchema,
  deleteCommentSchema,
  getCommentsSchema,
  getCommentRepliesSchema,
  updateCommentSchema,
} from '@api/schemas'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../init'

export const commentsRouter = createTRPCRouter({
  // Get comments for a document (public - anyone can read comments)
  getComments: publicProcedure.input(getCommentsSchema).query(async ({ ctx: { db }, input }) => {
    const comments = await getDocumentComments(db, input)

    const hasMore = comments.length > input.limit
    const results = hasMore ? comments.slice(0, input.limit) : comments

    // Fetch reply counts for top-level comments
    const commentsWithReplyCounts = await Promise.all(
      results.map(async (comment) => ({
        ...comment,
        replyCount: comment.parentId ? undefined : await getReplyCount(db, comment.id),
      }))
    )

    const nextCursor = hasMore ? (results.at(-1)?.createdAt?.toISOString() ?? null) : null

    return {
      comments: commentsWithReplyCounts,
      nextCursor,
    }
  }),

  // Get replies for a comment
  getReplies: publicProcedure
    .input(getCommentRepliesSchema)
    .query(async ({ ctx: { db }, input }) => {
      const replies = await getCommentReplies(db, input.commentId, {
        limit: input.limit,
        cursor: input.cursor,
      })

      const hasMore = replies.length > input.limit
      const results = hasMore ? replies.slice(0, input.limit) : replies

      const nextCursor = hasMore ? (results.at(-1)?.createdAt?.toISOString() ?? null) : null

      return {
        replies: results,
        nextCursor,
      }
    }),

  // Create a comment (authenticated)
  create: protectedProcedure.input(createCommentSchema).mutation(async ({ ctx, input }) => {
    // Verify document exists
    const document = await getDocumentById(ctx.db, input.documentId)
    if (!document) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Document not found',
      })
    }

    // If replying, verify parent comment exists and belongs to same document
    if (input.parentId) {
      const parentComment = await getCommentById(ctx.db, input.parentId)
      if (!parentComment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Parent comment not found',
        })
      }
      if (parentComment.documentId !== input.documentId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Parent comment does not belong to this document',
        })
      }
    }

    const comment = await createComment(ctx.db, input, ctx.user.id)
    return getCommentWithAuthor(ctx.db, comment.id)
  }),

  // Update a comment (only owner)
  update: protectedProcedure.input(updateCommentSchema).mutation(async ({ ctx, input }) => {
    const comment = await updateComment(ctx.db, input.id, ctx.user.id, input.content)

    if (!comment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Comment not found or you do not have permission to edit it',
      })
    }

    return getCommentWithAuthor(ctx.db, comment.id)
  }),

  // Delete a comment (only owner)
  delete: protectedProcedure.input(deleteCommentSchema).mutation(async ({ ctx, input }) => {
    const deleted = await deleteComment(ctx.db, input.id, ctx.user.id)

    if (!deleted) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Comment not found or you do not have permission to delete it',
      })
    }

    return { success: true }
  }),
})
