import { createRoute, z } from '@hono/zod-openapi'

import { getSubscriberStats } from '@api/db/queries/campaigns'
import { getSubscribersByWriter } from '@api/db/queries/subscribers'
import { createRouter } from '@api/lib/utils'
import { validateResponse } from '@api/lib/validate-response'
import { withRequiredScope } from '@api/rest/middleware'
import { errorResponses, subscriberStatsSchema, subscribersResponseSchema } from '@api/schemas'

const subscribersRouter = createRouter()

// List subscribers
subscribersRouter.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Subscribers'],
    summary: 'List your newsletter subscribers',
    security: [{ token: [] }],
    request: {
      query: z.object({
        status: z.enum(['confirmed', 'pending', 'unsubscribed']).optional(),
        limit: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'A list of subscribers',
        content: { 'application/json': { schema: subscribersResponseSchema } },
      },
      ...errorResponses(400, 401, 403, 429),
    },
    middleware: [withRequiredScope('subscribers.read')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const query = c.req.valid('query')

    const subscribers = await getSubscribersByWriter(db, session.user.id, {
      status: query.status,
      limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
    })

    return c.json(validateResponse({ data: subscribers }, subscribersResponseSchema))
  }
)

// Subscriber stats
subscribersRouter.openapi(
  createRoute({
    method: 'get',
    path: '/stats',
    tags: ['Subscribers'],
    summary: 'Get subscriber statistics',
    security: [{ token: [] }],
    responses: {
      200: {
        description: 'Subscriber statistics',
        content: { 'application/json': { schema: subscriberStatsSchema } },
      },
      ...errorResponses(401, 403, 429),
    },
    middleware: [withRequiredScope('subscribers.read')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')

    const stats = await getSubscriberStats(db, session.user.id)

    return c.json(validateResponse(stats, subscriberStatsSchema))
  }
)

export { subscribersRouter }
