import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import {
  getWriterNewsletterSettings,
  upsertWriterNewsletterSettings,
} from '@api/db/queries/newsletter-settings'
import {
  getConfirmedSubscribers,
  getSubscriberByEmail,
  getSubscriberByToken,
  upsertSubscriber,
} from '@api/db/queries/subscribers'
import { unsubscribeEvents } from '@api/db/schema'
import { enqueueConfirmationEmail, enqueueWelcomeEmail } from '@api/jobs/producers'
import { generateId } from '@api/lib/utils'
import { newsletterSettingsSchema } from '@api/schemas/newsletter'
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@api/trpc/init'

export const newsletterRouter = createTRPCRouter({
  getWriterNewsletterSettings: protectedProcedure.query(async ({ ctx }) => {
    const settings = await getWriterNewsletterSettings(ctx.db, ctx.user.id)
    return settings
  }),

  upsertNewsletterSettings: protectedProcedure
    .input(newsletterSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const settings = await upsertWriterNewsletterSettings(ctx.db, {
        writerId: ctx.user.id,
        id: input.id,
        newsletterName: input.newsletterName,
        fromName: input.fromName,
        logoUrl: input.logoUrl || null,
        brandColor: input.brandColor || null,
        confirmationUrl: input.confirmationUrl || null,
        isActive: input.isActive,
      })

      return settings
    }),

  /**
   * Subscribe to the newsletter
   * protected because we need to know the writerId
   * send the api key or auth cookie when calling this endpoint
   */
  subscribe: protectedProcedure
    .input(
      z.object({
        email: z.email(),
        sendConfirmation: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existingSub = await getSubscriberByEmail(ctx.db, input.email)

      if (existingSub) {
        // If already subscribed but not confirmed, resend confirmation
        if (!existingSub.isConfirmed && input.sendConfirmation) {
          const writerSettings = await getWriterNewsletterSettings(ctx.db, ctx.user.id)
          if (writerSettings) {
            await enqueueConfirmationEmail({
              subscriberId: existingSub.id,
              email: existingSub.email,
              token: existingSub.token,
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
          }
          return { success: true, message: 'Confirmation email resent' }
        }

        throw new TRPCError({
          message: 'Already joined the newsletter.',
          code: 'CONFLICT',
        })
      }

      const writerSettings = await getWriterNewsletterSettings(ctx.db, ctx.user.id)

      if (!writerSettings) {
        throw new TRPCError({
          message: 'Writer newsletter not found.',
          code: 'NOT_FOUND',
        })
      }

      try {
        const subCreated = await upsertSubscriber(ctx.db, {
          email: input.email,
          token: generateId('st'),
          writerId: ctx.user.id,
        })

        if (!subCreated) {
          throw new TRPCError({
            message: 'Subscription not created',
            code: 'INTERNAL_SERVER_ERROR',
          })
        }

        // Send welcome/confirmation email via job queue
        if (input.sendConfirmation) {
          await enqueueWelcomeEmail(
            {
              subscriberId: subCreated.id,
              email: subCreated.email,
              token: subCreated.token,
              writerId: ctx.user.id,
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
      } catch (error) {
        console.error('Subscription error:', error)
        throw new TRPCError({
          message: 'Something went wrong',
          code: 'INTERNAL_SERVER_ERROR',
        })
      }
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
        // Update subscriber status
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

  // Resend confirmation email
  resendConfirmation: protectedProcedure
    .input(z.object({ email: z.email() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await getSubscriberByEmail(ctx.db, input.email)

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

  // Get subscriber list for writer
  subscribers: protectedProcedure
    .input(
      z
        .object({
          confirmedOnly: z.boolean().optional().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (input?.confirmedOnly) {
        return getConfirmedSubscribers(ctx.db, ctx.user.id)
      }
      // TODO: Add query for all subscribers
      return getConfirmedSubscribers(ctx.db, ctx.user.id)
    }),
})
