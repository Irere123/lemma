import { eq, sql } from 'drizzle-orm'
import { GraphQLError } from 'graphql'

import {
  type CampaignStats,
  createCampaign,
  deleteCampaign,
  getCampaignById,
  getCampaignStats,
  getCampaignsByUser,
  getClicksByLink,
  getSubscriberStats,
  updateCampaign,
} from '@api/db/queries/campaigns'
import { getDocumentById } from '@api/db/queries/documents'
import { getWriterNewsletterSettings } from '@api/db/queries/newsletter-settings'
import { type Campaign, campaigns } from '@api/db/schema'
import { slugifyString } from '@api/db/utils/slugify'
import { enqueueNewsletter, scheduleNewsletter } from '@api/jobs/producers'
import { generateId } from '@api/lib/utils'
import type { GraphQLContext } from '../context'
import { requireScope } from '../context'
import {
  buildConnectionFromCursor,
  type Connection,
  type ConnectionArgs,
  decodeCursor,
  getLimit,
} from '../pagination'

type PaginationInput = ConnectionArgs

type CreateCampaignInput = {
  title: string
  documentId?: string
  content?: string
  scheduledAt?: Date
}

type SendCampaignInput = {
  campaignId: string
  documentId: string
}

type ScheduleCampaignInput = {
  campaignId: string
  documentId: string
  scheduledAt: Date
}

type LinkClickStats = {
  linkId: string
  url: string
  label: string | null
  clicks: number
}

async function getCampaignsTotalCount(db: any, userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaigns)
    .where(eq(campaigns.userId, userId))

  return result[0]?.count ?? 0
}

export const campaignResolvers = {
  Query: {
    campaigns: async (
      _: unknown,
      args: { pagination?: PaginationInput },
      context: GraphQLContext
    ): Promise<Connection<Campaign>> => {
      requireScope(context, 'campaigns.read')

      const { db, session } = context
      const userId = session!.user.id
      const limit = getLimit(args.pagination ?? {})
      const cursor = args.pagination?.after ? decodeCursor(args.pagination.after) : undefined

      const userCampaigns = await getCampaignsByUser(db, userId, {
        limit: limit + 1,
        cursor,
      })

      const totalCount = await getCampaignsTotalCount(db, userId)

      return buildConnectionFromCursor(
        userCampaigns,
        args.pagination ?? {},
        totalCount,
        (campaign) => campaign.createdAt?.toString() ?? campaign.id
      )
    },

    campaign: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext
    ): Promise<Campaign | null> => {
      requireScope(context, 'campaigns.read')

      const campaign = await getCampaignById(context.db, args.id)
      if (!campaign) return null

      if (campaign.userId !== context.session!.user.id) {
        throw new GraphQLError('Not authorized to access this campaign', {
          extensions: { code: 'FORBIDDEN' },
        })
      }

      return campaign
    },

    campaignStats: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext
    ): Promise<CampaignStats | null> => {
      requireScope(context, 'campaigns.read')

      const campaign = await getCampaignById(context.db, args.id)
      if (!campaign || campaign.userId !== context.session!.user.id) {
        throw new GraphQLError('Campaign not found or not authorized', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      return getCampaignStats(context.db, args.id)
    },

    campaignLinkClicks: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext
    ): Promise<LinkClickStats[]> => {
      requireScope(context, 'campaigns.read')

      const campaign = await getCampaignById(context.db, args.id)
      if (!campaign || campaign.userId !== context.session!.user.id) {
        throw new GraphQLError('Campaign not found or not authorized', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      return getClicksByLink(context.db, args.id)
    },

    subscriberStats: async (_: unknown, __: unknown, context: GraphQLContext) => {
      requireScope(context, 'subscribers.read')
      return getSubscriberStats(context.db, context.session!.user.id)
    },
  },

  Mutation: {
    createCampaign: async (
      _: unknown,
      args: { input: CreateCampaignInput },
      context: GraphQLContext
    ): Promise<Campaign> => {
      requireScope(context, 'campaigns.write')

      const { db, session } = context
      const slug = slugifyString(args.input.title) || generateId()

      return createCampaign(db, {
        title: args.input.title,
        slug,
        userId: session!.user.id,
        documentId: args.input.documentId,
        content: args.input.content,
        scheduledAt: args.input.scheduledAt,
        status: args.input.scheduledAt ? 'SCHEDULED' : 'DRAFT',
      })
    },

    sendCampaign: async (
      _: unknown,
      args: { input: SendCampaignInput },
      context: GraphQLContext
    ) => {
      requireScope(context, 'campaigns.write')

      const { db, session } = context
      const { campaignId, documentId } = args.input

      const campaign = await getCampaignById(db, campaignId)
      if (!campaign || campaign.userId !== session!.user.id) {
        throw new GraphQLError('Campaign not found', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      const document = await getDocumentById(db, documentId)
      if (!document) {
        throw new GraphQLError('Document not found', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      const writerSettings = await getWriterNewsletterSettings(db, session!.user.id)
      if (!writerSettings) {
        throw new GraphQLError('Newsletter settings not configured', {
          extensions: { code: 'BAD_REQUEST' },
        })
      }

      await updateCampaign(db, { id: campaignId, status: 'SENDING' })

      await enqueueNewsletter({
        campaignId,
        documentId,
        writerId: session!.user.id,
      })

      return { success: true, message: 'Newsletter queued for sending' }
    },

    scheduleCampaign: async (
      _: unknown,
      args: { input: ScheduleCampaignInput },
      context: GraphQLContext
    ) => {
      requireScope(context, 'campaigns.write')

      const { db, session } = context
      const { campaignId, documentId, scheduledAt } = args.input

      const campaign = await getCampaignById(db, campaignId)
      if (!campaign || campaign.userId !== session!.user.id) {
        throw new GraphQLError('Campaign not found', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      if (scheduledAt <= new Date()) {
        throw new GraphQLError('Scheduled time must be in the future', {
          extensions: { code: 'BAD_REQUEST' },
        })
      }

      await updateCampaign(db, {
        id: campaignId,
        scheduledAt,
        status: 'SCHEDULED',
      })

      await scheduleNewsletter({
        campaignId,
        documentId,
        writerId: session!.user.id,
        scheduledAt: scheduledAt.toISOString(),
      })

      return { success: true, message: 'Newsletter scheduled successfully' }
    },

    deleteCampaign: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      requireScope(context, 'campaigns.write')

      const { db, session } = context

      const campaign = await getCampaignById(db, args.id)
      if (!campaign || campaign.userId !== session!.user.id) {
        throw new GraphQLError('Campaign not found or not authorized', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      await deleteCampaign(db, args.id)
      return true
    },
  },

  Campaign: {
    // Field resolvers use per-request DataLoaders to batch across a list of
    // campaigns (avoids N+1). The parent campaign is already ownership-checked
    // by the query/mutation that produced it.
    document: async (parent: Campaign, _: unknown, context: GraphQLContext) => {
      if (!parent.documentId) return null
      return context.loaders.document(parent.documentId)
    },

    stats: async (parent: Campaign, _: unknown, context: GraphQLContext) => {
      return context.loaders.campaignStats(parent.id)
    },

    linkClicks: async (parent: Campaign, _: unknown, context: GraphQLContext) => {
      return context.loaders.campaignLinkClicks(parent.id)
    },
  },
}
