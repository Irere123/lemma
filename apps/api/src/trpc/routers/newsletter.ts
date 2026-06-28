import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import type { DB } from '@api/db'
import { getSubscriberStats } from '@api/db/queries/campaigns'
import {
  getWriterNewsletterSettings,
  upsertWriterNewsletterSettings,
} from '@api/db/queries/newsletter-settings'
import {
  deleteSubscriber,
  getSubscriberByToken,
  getSubscriberByWriterAndEmail,
  getSubscribersByWriter,
  getWriterSubscriberById,
  upsertSubscriber,
} from '@api/db/queries/subscribers'
import { getUserByUsername } from '@api/db/queries/users'
import { unsubscribeEvents } from '@api/db/schema'
import { env } from '@api/env-runtime'
import { enqueueConfirmationEmail, enqueueWelcomeEmail } from '@api/jobs/producers'
import { generateId } from '@api/lib/utils'
import { newsletterSettingsSchema } from '@api/schemas/newsletter'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@api/trpc/init'

/**
 * Shared subscribe logic, scoped to a writer. Used by both the protected
 * `subscribe` (writerId = the authed writer) and the public `subscribePublic`
 * (writerId resolved from a profile handle). Emails are unique per writer, so
 * the same email can subscribe to many writers.
 */
async function subscribeToWriter(
  db: DB,
  writerId: string,
  email: string,
  sendConfirmation: boolean
): Promise<{ success: boolean; message: string }> {
  const existingSub = await getSubscriberByWriterAndEmail(db, writerId, email)

  if (existingSub) {
    if (!existingSub.isConfirmed && sendConfirmation) {
      const writerSettings = await getWriterNewsletterSettings(db, writerId)
      if (writerSettings) {
        await enqueueConfirmationEmail({
          subscriberId: existingSub.id,
          email: existingSub.email,
          token: existingSub.token,
          writerId,
          writerSettings: {
            id: writerSettings.id,
            newsletterName: writerSettings.newsletterName,
            fromName: writerSettings.fromName,
            logoUrl: writerSettings.logoUrl,
            brandColor: writerSettings.brandColor,
            confirmationUrl: writerSettings.confirmationUrl,
          },
        })
      }
      return { success: true, message: 'Confirmation email resent' }
    }

    throw new TRPCError({ message: 'Already joined the newsletter.', code: 'CONFLICT' })
  }

  const writerSettings = await getWriterNewsletterSettings(db, writerId)
  if (!writerSettings) {
    throw new TRPCError({ message: 'Writer newsletter not found.', code: 'NOT_FOUND' })
  }

  const subCreated = await upsertSubscriber(db, {
    email,
    token: generateId('st'),
    writerId,
  })

  if (!subCreated) {
    throw new TRPCError({ message: 'Subscription not created', code: 'INTERNAL_SERVER_ERROR' })
  }

  if (sendConfirmation) {
    await enqueueWelcomeEmail(
      {
        subscriberId: subCreated.id,
        email: subCreated.email,
        token: subCreated.token,
        writerId,
        writerSettings: {
          id: writerSettings.id,
          newsletterName: writerSettings.newsletterName,
          fromName: writerSettings.fromName,
          logoUrl: writerSettings.logoUrl,
          brandColor: writerSettings.brandColor,
          confirmationUrl: writerSettings.confirmationUrl,
        },
      },
      { delay: 0, priority: 9 }
    )
  }

  return { success: true, message: 'Subscribed successfully' }
}

export const newsletterRouter = createTRPCRouter({
  getWriterNewsletterSettings: protectedProcedure.query(async ({ ctx }) => {
    const settings = await getWriterNewsletterSettings(ctx.db, ctx.user.id)
    return settings
  }),

  /**
   * Public-safe newsletter info for an author's profile. Returns null when the
   * writer has no newsletter or has it switched off, so the subscribe widget
   * only renders when there's something to subscribe to.
   */
  getPublicSettings: publicProcedure
    .input(
      z
        .object({
          username: z.string().optional(),
          writerId: z.string().optional(),
        })
        .refine((v) => v.username || v.writerId, {
          message: 'A writer handle or id is required.',
        })
    )
    .query(async ({ ctx, input }) => {
      let writerId = input.writerId
      if (!writerId && input.username) {
        const writer = await getUserByUsername(ctx.db, input.username)
        if (!writer) return null
        writerId = writer.id
      }

      const settings = await getWriterNewsletterSettings(ctx.db, writerId as string)
      if (!settings || !settings.isActive) return null

      return {
        writerId: writerId as string,
        newsletterName: settings.newsletterName,
        fromName: settings.fromName,
        brandColor: settings.brandColor,
        logoUrl: settings.logoUrl,
      }
    }),

  upsertNewsletterSettings: protectedProcedure
    .input(newsletterSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      // Default the confirmation URL to the hosted confirm page so subscription
      // emails always carry a working link even if the writer leaves it blank.
      const confirmationUrl =
        input.confirmationUrl || (env.FRONTEND_URL ? `${env.FRONTEND_URL}/subscribe/confirm` : null)

      const settings = await upsertWriterNewsletterSettings(ctx.db, {
        writerId: ctx.user.id,
        id: input.id,
        newsletterName: input.newsletterName,
        fromName: input.fromName,
        logoUrl: input.logoUrl || null,
        brandColor: input.brandColor || null,
        confirmationUrl,
        isActive: input.isActive,
      })

      return settings
    }),

  /**
   * Subscribe to the authed writer's own newsletter (e.g. API-key/cURL usage).
   * The writer is taken from the session.
   */
  subscribe: protectedProcedure
    .input(
      z.object({
        email: z.email(),
        sendConfirmation: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return subscribeToWriter(ctx.db, ctx.user.id, input.email, input.sendConfirmation)
    }),

  /**
   * Public newsletter signup from an author's profile. A logged-out visitor
   * subscribes to the writer identified by handle (or id).
   */
  subscribePublic: publicProcedure
    .input(
      z
        .object({
          username: z.string().optional(),
          writerId: z.string().optional(),
          email: z.email(),
          sendConfirmation: z.boolean().optional().default(true),
        })
        .refine((v) => v.username || v.writerId, {
          message: 'A writer handle or id is required.',
        })
    )
    .mutation(async ({ ctx, input }) => {
      let writerId = input.writerId
      if (!writerId && input.username) {
        const writer = await getUserByUsername(ctx.db, input.username)
        if (!writer) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Writer not found' })
        }
        writerId = writer.id
      }
      return subscribeToWriter(ctx.db, writerId as string, input.email, input.sendConfirmation)
    }),

  unsubscribe: publicProcedure
    .input(
      z.object({
        token: z.string(),
        reason: z.string().optional(),
        campaignId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sub = await getSubscriberByToken(ctx.db, input.token)

      if (!sub) {
        throw new TRPCError({
          message: 'Subscription not found',
          code: 'NOT_FOUND',
        })
      }

      try {
        await upsertSubscriber(ctx.db, {
          id: sub.id,
          isUnsubscribed: true,
          email: sub.email,
          token: sub.token,
          unsubscribedAt: new Date(),
          writerId: sub.writerId as string,
        })

        // Record unsubscribe event for analytics
        await ctx.db.insert(unsubscribeEvents).values({
          id: generateId('unsub'),
          subscriberId: sub.id,
          campaignId: input.campaignId || null,
          unsubscribedAt: new Date(),
          reason: input.reason || null,
        })

        return { success: true }
      } catch (error) {
        console.error('Unsubscribe error:', error)
        throw new TRPCError({
          message: 'Something went wrong',
          code: 'INTERNAL_SERVER_ERROR',
        })
      }
    }),

  confirmation: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await getSubscriberByToken(ctx.db, input.token)

      if (!sub) {
        throw new TRPCError({
          message: 'Subscription not found',
          code: 'NOT_FOUND',
        })
      }

      if (sub.isConfirmed) {
        return { success: true, message: 'Already confirmed' }
      }

      try {
        await upsertSubscriber(ctx.db, {
          id: sub.id,
          isConfirmed: true,
          confirmedAt: new Date(),
          email: sub.email,
          token: sub.token,
          writerId: sub.writerId as string,
        })

        return { success: true, message: 'Subscription confirmed' }
      } catch (error) {
        console.error('Confirmation error:', error)
        throw new TRPCError({
          message: 'Something went wrong',
          code: 'INTERNAL_SERVER_ERROR',
        })
      }
    }),

  resendConfirmation: protectedProcedure
    .input(z.object({ email: z.email() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await getSubscriberByWriterAndEmail(ctx.db, ctx.user.id, input.email)

      if (!sub) {
        throw new TRPCError({
          message: 'Subscription not found',
          code: 'NOT_FOUND',
        })
      }

      if (sub.isConfirmed) {
        return { success: true, message: 'Already confirmed' }
      }

      const writerSettings = await getWriterNewsletterSettings(ctx.db, ctx.user.id)

      if (!writerSettings) {
        throw new TRPCError({
          message: 'Writer newsletter not found.',
          code: 'NOT_FOUND',
        })
      }

      await enqueueConfirmationEmail({
        subscriberId: sub.id,
        email: sub.email,
        token: sub.token,
        writerId: ctx.user.id,
        writerSettings: {
          id: writerSettings.id,
          newsletterName: writerSettings.newsletterName,
          fromName: writerSettings.fromName,
          logoUrl: writerSettings.logoUrl,
          brandColor: writerSettings.brandColor,
          confirmationUrl: writerSettings.confirmationUrl,
        },
      })

      return { success: true, message: 'Confirmation email sent' }
    }),

  // Subscriber list for the writer, filtered by lifecycle state.
  subscribers: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(['all', 'confirmed', 'pending', 'unsubscribed']).optional().default('all'),
          limit: z.number().min(1).max(100).optional().default(100),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? 'all'
      return getSubscribersByWriter(ctx.db, ctx.user.id, {
        status: status === 'all' ? undefined : status,
        limit: input?.limit ?? 100,
      })
    }),

  // Counts by lifecycle state for the subscribers dashboard.
  subscriberStats: protectedProcedure.query(async ({ ctx }) => {
    return getSubscriberStats(ctx.db, ctx.user.id)
  }),

  // Manually add an already-confirmed subscriber (e.g. importing a contact).
  // No confirmation email is sent — the writer vouches for the address.
  addSubscriber: protectedProcedure
    .input(z.object({ email: z.email() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getSubscriberByWriterAndEmail(ctx.db, ctx.user.id, input.email)
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'That email is already on your list.' })
      }

      return upsertSubscriber(ctx.db, {
        email: input.email,
        token: generateId('st'),
        writerId: ctx.user.id,
        isConfirmed: true,
        confirmedAt: new Date(),
      })
    }),

  // Permanently remove a subscriber from the writer's list.
  removeSubscriber: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await getWriterSubscriberById(ctx.db, input.id, ctx.user.id)
      if (!sub) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Subscriber not found' })
      }

      await deleteSubscriber(ctx.db, input.id)
      return { success: true }
    }),
})
