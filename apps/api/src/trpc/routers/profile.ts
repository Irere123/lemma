import { TRPCError } from '@trpc/server'

import {
  ensureUniqueUsername,
  getPublicProfile,
  getPublishedArticles,
  getUserById,
  getUserByUsername,
  isUsernameAvailable,
  updateUserProfile,
} from '@api/db/queries'
import {
  checkUsernameSchema,
  getProfileByUsernameSchema,
  profilePostsSchema,
  updateSocialLinksSchema,
} from '@api/schemas'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../init'

export const profileRouter = createTRPCRouter({
  // Public author profile resolved by handle, with follow/post counts and
  // whether the current viewer (if any) already follows the author.
  getByUsername: publicProcedure.input(getProfileByUsernameSchema).query(async ({ ctx, input }) => {
    const profile = await getPublicProfile(ctx.db, input.username, ctx.user?.id)
    if (!profile) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' })
    }
    return profile
  }),

  // Published posts for a handle (Latest / Popular tabs).
  posts: publicProcedure.input(profilePostsSchema).query(async ({ ctx, input }) => {
    const author = await getUserByUsername(ctx.db, input.username)
    if (!author) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' })
    }
    return getPublishedArticles(ctx.db, {
      writerId: author.id,
      sort: input.sort,
      limit: input.limit,
    })
  }),

  // Current user's editable profile fields (for the settings form).
  me: protectedProcedure.query(async ({ ctx }) => {
    const me = await getUserById(ctx.db, ctx.user.id)
    if (!me) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
    }
    return {
      id: me.id,
      name: me.name,
      image: me.image,
      username: me.username,
      bio: me.bio,
      website: me.website,
      location: me.location,
      socialLinks: me.socialLinks ?? null,
    }
  }),

  // Debounced availability check for the handle field in settings.
  checkUsername: protectedProcedure.input(checkUsernameSchema).query(async ({ ctx, input }) => {
    const available = await isUsernameAvailable(ctx.db, input.username, ctx.user.id)
    return { available }
  }),

  // Backfill a handle for accounts created before handles existed. Idempotent.
  ensureUsername: protectedProcedure.mutation(async ({ ctx }) => {
    const me = await getUserById(ctx.db, ctx.user.id)
    if (!me) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
    }
    if (me.username) {
      return { username: me.username }
    }
    const base = me.name?.trim() || me.email.split('@')[0] || 'user'
    const username = await ensureUniqueUsername(ctx.db, base)
    const updated = await updateUserProfile(ctx.db, ctx.user.id, { username })
    return { username: updated?.username ?? username }
  }),

  // socialLinks is a JSON column, so it is written here rather than via
  // better-auth's scalar additionalFields.
  updateSocialLinks: protectedProcedure
    .input(updateSocialLinksSchema)
    .mutation(async ({ ctx, input }) => {
      // Drop empty strings so cleared fields are stored as absent.
      const cleaned = Object.fromEntries(
        Object.entries(input.socialLinks).filter(([, v]) => v && v.length > 0)
      )
      const updated = await updateUserProfile(ctx.db, ctx.user.id, { socialLinks: cleaned })
      return { socialLinks: updated?.socialLinks ?? null }
    }),
})
