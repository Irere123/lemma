import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import {
  createCampaign,
  createCampaignLink,
  deleteCampaign,
  getCampaignById,
  getCampaignLinks,
  getCampaignsByUser,
  getCampaignStats,
  getClicksByLink,
  getClicksOverTime,
  getSubscriberGrowth,
  getSubscriberStats,
  updateCampaign,
} from '@api/db/queries/campaigns'
import { getDocumentById } from '@api/db/queries/documents'
import { getWriterNewsletterSettings } from '@api/db/queries/newsletter-settings'
import { slugifyString } from '@api/db/utils/slugify'
import { enqueueABTest, enqueueNewsletter, scheduleNewsletter } from '@api/jobs/producers'
import { generateId } from '@api/lib/utils'
import { createTRPCRouter, protectedProcedure } from '@api/trpc/init'

const campaignStatusSchema = z.enum([
  'DRAFT',
  'SCHEDULED',
  'SENDING',
  'SENT',
  'FAILED',
  'CANCELLED',
])

export const campaignsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional().default(20),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const campaigns = await getCampaignsByUser(ctx.db, ctx.user.id, input)
      return campaigns
    }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const campaign = await getCampaignById(ctx.db, input.id)

    if (!campaign || campaign.userId !== ctx.user.id) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Campaign not found',
      })
    }

    return campaign
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        documentId: z.string().optional(),
        content: z.string().optional(),
        scheduledAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = slugifyString(input.title) || generateId()

      const campaign = await createCampaign(ctx.db, {
        title: input.title,
        slug,
        userId: ctx.user.id,
        documentId: input.documentId,
        content: input.content,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        status: input.scheduledAt ? 'SCHEDULED' : 'DRAFT',
      })

      return campaign
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        content: z.string().optional(),
        scheduledAt: z.string().datetime().optional(),
        status: campaignStatusSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getCampaignById(ctx.db, input.id)

      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        })
      }

      const campaign = await updateCampaign(ctx.db, {
        id: input.id,
        title: input.title,
        content: input.content,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        status: input.status,
      })

      return campaign
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getCampaignById(ctx.db, input.id)

      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        })
      }

      await deleteCampaign(ctx.db, input.id)

      return { success: true }
    }),

  send: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        documentId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(ctx.db, input.campaignId)

      if (!campaign || campaign.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        })
      }

      const document = await getDocumentById(ctx.db, input.documentId)
      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        })
      }

      const writerSettings = await getWriterNewsletterSettings(ctx.db, ctx.user.id)
      if (!writerSettings) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Newsletter settings not configured',
        })
      }

      await updateCampaign(ctx.db, {
        id: input.campaignId,
        status: 'SENDING',
      })

      await enqueueNewsletter({
        campaignId: input.campaignId,
        documentId: input.documentId,
        writerId: ctx.user.id,
      })

      return { success: true, message: 'Newsletter queued for sending' }
    }),

  schedule: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        documentId: z.string(),
        scheduledAt: z.string().datetime(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(ctx.db, input.campaignId)

      if (!campaign || campaign.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        })
      }

      const scheduledDate = new Date(input.scheduledAt)
      if (scheduledDate <= new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Scheduled time must be in the future',
        })
      }

      await updateCampaign(ctx.db, {
        id: input.campaignId,
        scheduledAt: scheduledDate,
        status: 'SCHEDULED',
      })

      await scheduleNewsletter({
        campaignId: input.campaignId,
        documentId: input.documentId,
        writerId: ctx.user.id,
        scheduledAt: input.scheduledAt,
      })

      return { success: true, message: 'Newsletter scheduled successfully' }
    }),

  createABTest: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        variants: z
          .array(
            z.object({
              name: z.string(),
              documentId: z.string(),
              percentage: z.number().min(1).max(100),
            })
          )
          .min(2)
          .max(4),
        testDurationHours: z.number().min(1).max(168).default(24), // Max 7 days
      })
    )
    .mutation(async ({ ctx, input }) => {
      const totalPercentage = input.variants.reduce((sum, v) => sum + v.percentage, 0)
      if (totalPercentage !== 100) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Variant percentages must add up to 100',
        })
      }

      const parentSlug = slugifyString(input.title) || generateId()
      const parentCampaign = await createCampaign(ctx.db, {
        title: input.title,
        slug: parentSlug,
        userId: ctx.user.id,
        status: 'SENDING',
      })

      const variants: { variantId: string; documentId: string; percentage: number }[] = []

      for (const variant of input.variants) {
        const variantCampaign = await createCampaign(ctx.db, {
          title: `${input.title} - ${variant.name}`,
          slug: `${parentSlug}-${variant.name.toLowerCase().replace(/\s+/g, '-')}`,
          userId: ctx.user.id,
          documentId: variant.documentId,
          status: 'SENDING',
        })

        variants.push({
          variantId: variantCampaign.id,
          documentId: variant.documentId,
          percentage: variant.percentage,
        })
      }

      await enqueueABTest({
        campaignId: parentCampaign.id,
        variants,
        writerId: ctx.user.id,
        testDurationHours: input.testDurationHours,
      })

      return {
        success: true,
        campaignId: parentCampaign.id,
        variants: variants.map((v) => v.variantId),
      }
    }),

  stats: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await getCampaignById(ctx.db, input.campaignId)

      if (!campaign || campaign.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        })
      }

      const stats = await getCampaignStats(ctx.db, input.campaignId)
      const linkClicks = await getClicksByLink(ctx.db, input.campaignId)

      return {
        ...stats,
        linkClicks,
      }
    }),

  clicksOverTime: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      })
    )
    .query(async ({ ctx, input }) => {
      const campaign = await getCampaignById(ctx.db, input.campaignId)

      if (!campaign || campaign.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        })
      }

      return getClicksOverTime(
        ctx.db,
        input.campaignId,
        new Date(input.startDate),
        new Date(input.endDate)
      )
    }),

  addLink: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        url: z.string().url(),
        label: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await getCampaignById(ctx.db, input.campaignId)

      if (!campaign || campaign.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        })
      }

      const link = await createCampaignLink(ctx.db, {
        campaignId: input.campaignId,
        url: input.url,
        label: input.label,
      })

      return link
    }),

  getLinks: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await getCampaignById(ctx.db, input.campaignId)

      if (!campaign || campaign.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        })
      }

      return getCampaignLinks(ctx.db, input.campaignId)
    }),

  subscriberStats: protectedProcedure.query(async ({ ctx }) => {
    return getSubscriberStats(ctx.db, ctx.user.id)
  }),

  subscriberGrowth: protectedProcedure
    .input(
      z.object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      })
    )
    .query(async ({ ctx, input }) => {
      return getSubscriberGrowth(
        ctx.db,
        ctx.user.id,
        new Date(input.startDate),
        new Date(input.endDate)
      )
    }),
})
