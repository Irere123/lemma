import { z } from '@hono/zod-openapi'

// Note: the `token` column is intentionally excluded — it is a secret used for
// unsubscribe links and must never be exposed through the API.
export const subscriberSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    writerId: z.string().nullable(),
    subscribedAt: z.date().nullable(),
    confirmedAt: z.date().nullable(),
    unsubscribedAt: z.date().nullable(),
    isConfirmed: z.boolean().nullable(),
    isUnsubscribed: z.boolean().nullable(),
  })
  .openapi('Subscriber')

export const subscribersResponseSchema = z.object({
  data: z.array(subscriberSchema),
})

export const subscriberStatsSchema = z
  .object({
    total: z.number(),
    confirmed: z.number(),
    unsubscribed: z.number(),
    pending: z.number(),
  })
  .openapi('SubscriberStats')
