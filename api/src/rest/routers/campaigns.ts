import { createRoute, z } from '@hono/zod-openapi'

import { createRouter, generateId } from '@api/lib/utils'
import { withAuth } from '@api/rest/middleware/auth'
import {
  createCampaign,
  updateCampaign,
  getCampaignById,
  getCampaignsByUser,
  deleteCampaign,
  getCampaignStats,
  getClicksByLink,
  getSubscriberStats,
} from '@api/db/queries/campaigns'
import { getDocumentById } from '@api/db/queries/documents'
import { getWriterNewsletterSettings } from '@api/db/queries/newsletter-settings'
import { slugifyString } from '@api/db/utils/slugify'
import { enqueueNewsletter, scheduleNewsletter } from '@api/jobs/producers'

const campaignsRouter = createRouter()

// Campaign schema
const campaignSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  userId: z.string(),
  documentId: z.string().nullable(),
  content: z.string().nullable(),
  status: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  sentAt: z.string().nullable(),
  totalSent: z.string().nullable(),
  totalOpens: z.string().nullable(),
  totalClicks: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

const campaignStatsSchema = z.object({
  campaignId: z.string(),
  totalSent: z.number(),
  totalClicks: z.number(),
  uniqueClicks: z.number(),
  totalUnsubscribes: z.number(),
  clickRate: z.number(),
  unsubscribeRate: z.number(),
})

// List campaigns
campaignsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Campaigns'],
    summary: 'List all campaigns',
    security: [{ token: [] }],
    request: {
      query: z.object({
        limit: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'List of campaigns',
        content: {
          'application/json': {
            schema: z.object({
              data: z.array(campaignSchema),
            }),
          },
        },
      },
    },
    middleware: [withAuth],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const query = c.req.valid('query')

    const campaigns = await getCampaignsByUser(db, session.user.id, {
      limit: query.limit ? parseInt(query.limit, 10) : 20,
    })

    return c.json({ data: campaigns })
  }
)

// Get campaign by ID
campaignsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/:id',
    tags: ['Campaigns'],
    summary: 'Get campaign by ID',
    security: [{ token: [] }],
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Campaign details',
        content: {
          'application/json': {
            schema: campaignSchema,
          },
        },
      },
      404: { description: 'Campaign not found' },
    },
    middleware: [withAuth],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')

    const campaign = await getCampaignById(db, id)

    if (!campaign || campaign.userId !== session.user.id) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    return c.json(campaign)
  }
)

// Create campaign
campaignsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/',
    tags: ['Campaigns'],
    summary: 'Create a new campaign',
    security: [{ token: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              title: z.string().min(1),
              documentId: z.string().optional(),
              content: z.string().optional(),
              scheduledAt: z.string().datetime().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Campaign created',
        content: {
          'application/json': {
            schema: campaignSchema,
          },
        },
      },
    },
    middleware: [withAuth],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const input = c.req.valid('json')

    const slug = slugifyString(input.title) || generateId()

    const campaign = await createCampaign(db, {
      title: input.title,
      slug,
      userId: session.user.id,
      documentId: input.documentId,
      content: input.content,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      status: input.scheduledAt ? 'SCHEDULED' : 'DRAFT',
    })

    return c.json(campaign, 201)
  }
)

// Send campaign
campaignsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/:id/send',
    tags: ['Campaigns'],
    summary: 'Send a campaign immediately',
    security: [{ token: [] }],
    request: {
      params: z.object({
        id: z.string(),
      }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              documentId: z.string(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Campaign queued for sending',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
            }),
          },
        },
      },
      404: { description: 'Campaign or document not found' },
    },
    middleware: [withAuth],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')
    const { documentId } = c.req.valid('json')

    const campaign = await getCampaignById(db, id)
    if (!campaign || campaign.userId !== session.user.id) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    const document = await getDocumentById(db, documentId)
    if (!document) {
      return c.json({ error: 'Document not found' }, 404)
    }

    const writerSettings = await getWriterNewsletterSettings(db, session.user.id)
    if (!writerSettings) {
      return c.json({ error: 'Newsletter settings not configured' }, 400)
    }

    // Update status
    await updateCampaign(db, { id, status: 'SENDING' })

    // Enqueue
    await enqueueNewsletter({
      campaignId: id,
      documentId,
      writerId: session.user.id,
    })

    return c.json({ success: true, message: 'Newsletter queued for sending' })
  }
)

// Schedule campaign
campaignsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/:id/schedule',
    tags: ['Campaigns'],
    summary: 'Schedule a campaign for later',
    security: [{ token: [] }],
    request: {
      params: z.object({
        id: z.string(),
      }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              documentId: z.string(),
              scheduledAt: z.string().datetime(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Campaign scheduled',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
            }),
          },
        },
      },
      400: { description: 'Invalid scheduled time' },
      404: { description: 'Campaign not found' },
    },
    middleware: [withAuth],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')
    const { documentId, scheduledAt } = c.req.valid('json')

    const campaign = await getCampaignById(db, id)
    if (!campaign || campaign.userId !== session.user.id) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    const scheduledDate = new Date(scheduledAt)
    if (scheduledDate <= new Date()) {
      return c.json({ error: 'Scheduled time must be in the future' }, 400)
    }

    // Update campaign
    await updateCampaign(db, {
      id,
      scheduledAt: scheduledDate,
      status: 'SCHEDULED',
    })

    // Schedule the job
    await scheduleNewsletter({
      campaignId: id,
      documentId,
      writerId: session.user.id,
      scheduledAt,
    })

    return c.json({ success: true, message: 'Newsletter scheduled successfully' })
  }
)

// Get campaign stats
campaignsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/:id/stats',
    tags: ['Campaigns'],
    summary: 'Get campaign statistics',
    security: [{ token: [] }],
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Campaign statistics',
        content: {
          'application/json': {
            schema: campaignStatsSchema,
          },
        },
      },
      404: { description: 'Campaign not found' },
    },
    middleware: [withAuth],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')

    const campaign = await getCampaignById(db, id)
    if (!campaign || campaign.userId !== session.user.id) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    const stats = await getCampaignStats(db, id)
    return c.json(stats)
  }
)

// Get link clicks breakdown
campaignsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/:id/link-clicks',
    tags: ['Campaigns'],
    summary: 'Get link click breakdown for a campaign',
    security: [{ token: [] }],
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Link click breakdown',
        content: {
          'application/json': {
            schema: z.object({
              data: z.array(
                z.object({
                  linkId: z.string(),
                  url: z.string(),
                  label: z.string().nullable(),
                  clicks: z.number(),
                })
              ),
            }),
          },
        },
      },
      404: { description: 'Campaign not found' },
    },
    middleware: [withAuth],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')

    const campaign = await getCampaignById(db, id)
    if (!campaign || campaign.userId !== session.user.id) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    const clicks = await getClicksByLink(db, id)
    return c.json({ data: clicks })
  }
)

// Delete campaign
campaignsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/:id',
    tags: ['Campaigns'],
    summary: 'Delete a campaign',
    security: [{ token: [] }],
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Campaign deleted',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
            }),
          },
        },
      },
      404: { description: 'Campaign not found' },
    },
    middleware: [withAuth],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const { id } = c.req.valid('param')

    const campaign = await getCampaignById(db, id)
    if (!campaign || campaign.userId !== session.user.id) {
      return c.json({ error: 'Campaign not found' }, 404)
    }

    await deleteCampaign(db, id)
    return c.json({ success: true })
  }
)

// Subscriber stats endpoint
campaignsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/subscribers/stats',
    tags: ['Analytics'],
    summary: 'Get subscriber statistics',
    security: [{ token: [] }],
    responses: {
      200: {
        description: 'Subscriber statistics',
        content: {
          'application/json': {
            schema: z.object({
              total: z.number(),
              confirmed: z.number(),
              unsubscribed: z.number(),
              pending: z.number(),
            }),
          },
        },
      },
    },
    middleware: [withAuth],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')

    const stats = await getSubscriberStats(db, session.user.id)
    return c.json(stats)
  }
)

export { campaignsRouter }
