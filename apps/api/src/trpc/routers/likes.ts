import { TRPCError } from '@trpc/server'

import { getLikeStatus, toggleLike, getDocumentById, getDocumentLikeCount } from '@api/db/queries'
import { toggleLikeSchema, getLikeStatusSchema } from '@api/schemas'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../init'

export const likesRouter = createTRPCRouter({
  // Get like status for a document
  getStatus: publicProcedure.input(getLikeStatusSchema).query(async ({ ctx, input }) => {
    if (!ctx.user) {
      // For unauthenticated users, just return count
      const likeCount = await getDocumentLikeCount(ctx.db, input.documentId)
      return { isLiked: false, likeCount }
    }

    return getLikeStatus(ctx.db, input.documentId, ctx.user.id)
  }),

  // Toggle like (authenticated only)
  toggle: protectedProcedure.input(toggleLikeSchema).mutation(async ({ ctx, input }) => {
    // Verify document exists
    const document = await getDocumentById(ctx.db, input.documentId)
    if (!document) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Document not found',
      })
    }

    return toggleLike(ctx.db, input.documentId, ctx.user.id)
  }),
})
