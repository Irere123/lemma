import { TRPCError } from '@trpc/server'

import {
  followUser,
  getFollowerCount,
  getFollowers,
  getFollowing,
  getUserById,
  isFollowing,
  unfollowUser,
} from '@api/db/queries'
import { followListSchema, followStatusSchema, followUserSchema } from '@api/schemas'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../init'

export const followsRouter = createTRPCRouter({
  follow: protectedProcedure.input(followUserSchema).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user.id) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot follow yourself.' })
    }
    const target = await getUserById(ctx.db, input.userId)
    if (!target) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
    }
    await followUser(ctx.db, ctx.user.id, input.userId)
    const followerCount = await getFollowerCount(ctx.db, input.userId)
    return { isFollowing: true, followerCount }
  }),

  unfollow: protectedProcedure.input(followUserSchema).mutation(async ({ ctx, input }) => {
    await unfollowUser(ctx.db, ctx.user.id, input.userId)
    const followerCount = await getFollowerCount(ctx.db, input.userId)
    return { isFollowing: false, followerCount }
  }),

  // Public: anonymous viewers always get isFollowing=false.
  status: publicProcedure.input(followStatusSchema).query(async ({ ctx, input }) => {
    const [following, followerCount] = await Promise.all([
      isFollowing(ctx.db, ctx.user?.id, input.userId),
      getFollowerCount(ctx.db, input.userId),
    ])
    return { isFollowing: following, followerCount }
  }),

  followers: publicProcedure.input(followListSchema).query(async ({ ctx, input }) => {
    return getFollowers(ctx.db, input.userId, { limit: input.limit, cursor: input.cursor })
  }),

  following: publicProcedure.input(followListSchema).query(async ({ ctx, input }) => {
    return getFollowing(ctx.db, input.userId, { limit: input.limit, cursor: input.cursor })
  }),
})
