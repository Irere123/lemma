import { GraphQLError } from 'graphql'

import { getLikeStatus, toggleLike, getDocumentById, getDocumentLikeCount } from '@api/db/queries'
import type { GraphQLContext } from '../context'
import { requireAuth, requireScope } from '../context'

type LikeStatus = {
  isLiked: boolean
  likeCount: number
}

type ToggleLikeResult = {
  liked: boolean
  likeCount: number
}

export const likeResolvers = {
  Query: {
    likeStatus: async (
      _: unknown,
      args: { documentId: string },
      context: GraphQLContext
    ): Promise<LikeStatus> => {
      const { db, session } = context

      if (!session) {
        // Unauthenticated - return count only
        const likeCount = await getDocumentLikeCount(db, args.documentId)
        return { isLiked: false, likeCount }
      }

      return getLikeStatus(db, args.documentId, session.user.id)
    },
  },

  Mutation: {
    toggleLike: async (
      _: unknown,
      args: { documentId: string },
      context: GraphQLContext
    ): Promise<ToggleLikeResult> => {
      requireAuth(context)
      requireScope(context, 'likes.write')

      const { db, session } = context

      const document = await getDocumentById(db, args.documentId)
      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      return toggleLike(db, args.documentId, session!.user.id)
    },
  },
}
