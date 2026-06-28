import { createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import { getWriterNewsletterSettings } from '@api/db/queries/newsletter-settings'
import {
  getSubscriberByToken,
  getSubscriberByWriterAndEmail,
  upsertSubscriber,
} from '@api/db/queries/subscribers'
import { unsubscribeEvents } from '@api/db/schema'
import { enqueueConfirmationEmail, enqueueWelcomeEmail } from '@api/jobs/producers'
import { createRouter, generateId } from '@api/lib/utils'
import { withRequiredScope } from '@api/rest/middleware'
import { withAuth } from '@api/rest/middleware/auth'
import { errorResponses } from '@api/schemas'

const newsletterRouter = createRouter()

// Protected: the authenticated writer adds a subscriber to their own list.
newsletterRouter.openapi(
  createRoute({
    method: 'post',
    path: '/subscribe',
    tags: ['Newsletter'],
    summary: 'Subscribe an email to your newsletter',
    security: [{ token: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              email: z.email(),
              sendConfirmation: z.boolean().optional().default(true),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Subscription successful',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              message: z.string().optional(),
            }),
          },
        },
      },
      ...errorResponses(400, 401, 403, 404, 409, 429),
    },
    middleware: [withAuth, withRequiredScope('subscribers.write')],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const input = c.req.valid('json') as { email: string; sendConfirmation?: boolean }

    const existing = await getSubscriberByWriterAndEmail(db, session.user.id, input.email)

    if (existing) {
      // If already subscribed but not confirmed, resend confirmation
      if (!existing.isConfirmed && input.sendConfirmation !== false) {
        const writerSettings = await getWriterNewsletterSettings(db, session.user.id)
        if (writerSettings) {
          await enqueueConfirmationEmail({
            subscriberId: existing.id,
            email: existing.email,
            token: existing.token,
            writerId: session.user.id,
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
        return c.json({ success: true, message: 'Confirmation email resent' })
      }
      throw new HTTPException(409, { message: 'Already joined the newsletter.' })
    }

    const token = generateId('st')
    const writerSettings = await getWriterNewsletterSettings(db, session.user.id)

    if (!writerSettings) {
      throw new HTTPException(404, { message: 'Writer newsletter settings not found' })
    }

    const subCreated = await upsertSubscriber(db, {
      email: input.email,
      token,
      writerId: session.user.id,
    })

    if (input.sendConfirmation !== false && subCreated) {
      await enqueueWelcomeEmail(
        {
          subscriberId: subCreated.id,
          email: subCreated.email,
          token: subCreated.token,
          writerId: session.user.id,
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

    return c.json({ success: true, message: 'Subscribed successfully' })
  }
)

// Unsubscribe (public — invoked from email links via token)
newsletterRouter.openapi(
  createRoute({
    method: 'post',
    path: '/unsubscribe',
    tags: ['Newsletter'],
    summary: 'Unsubscribe from newsletter',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              token: z.string(),
              reason: z.string().optional(),
              campaignId: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Unsubscribed',
        content: {
          'application/json': {
            schema: z.object({ success: z.boolean() }),
          },
        },
      },
      ...errorResponses(400, 404, 429),
    },
  }),
  async (c) => {
    const db = c.get('db')
    const input = c.req.valid('json') as { token: string; reason?: string; campaignId?: string }

    const sub = await getSubscriberByToken(db, input.token)
    if (!sub) {
      throw new HTTPException(404, { message: 'Subscription not found' })
    }

    await upsertSubscriber(db, {
      id: sub.id,
      isUnsubscribed: true,
      unsubscribedAt: new Date(),
      email: sub.email,
      token: sub.token,
      writerId: sub.writerId,
    })

    // Record unsubscribe event for analytics
    await db.insert(unsubscribeEvents).values({
      id: generateId('unsub'),
      subscriberId: sub.id,
      campaignId: input.campaignId || null,
      unsubscribedAt: new Date(),
      reason: input.reason || null,
    })

    return c.json({ success: true })
  }
)

// Confirm subscription (public — invoked from email links via token)
newsletterRouter.openapi(
  createRoute({
    method: 'post',
    path: '/confirmation',
    tags: ['Newsletter'],
    summary: 'Confirm subscription',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({ token: z.string() }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Confirmed',
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              message: z.string().optional(),
            }),
          },
        },
      },
      ...errorResponses(400, 404, 429),
    },
  }),
  async (c) => {
    const db = c.get('db')
    const input = c.req.valid('json') as { token: string }

    const sub = await getSubscriberByToken(db, input.token)
    if (!sub) {
      throw new HTTPException(404, { message: 'Subscription not found' })
    }

    if (sub.isConfirmed) {
      return c.json({ success: true, message: 'Already confirmed' })
    }

    await upsertSubscriber(db, {
      id: sub.id,
      isConfirmed: true,
      confirmedAt: new Date(),
      email: sub.email,
      token: sub.token,
      writerId: sub.writerId,
    })

    return c.json({ success: true, message: 'Subscription confirmed' })
  }
)

// Get subscription status by token (for unsubscribe pages)
newsletterRouter.openapi(
  createRoute({
    method: 'get',
    path: '/status/:token',
    tags: ['Newsletter'],
    summary: 'Get subscription status by token',
    request: {
      params: z.object({
        token: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Subscription status',
        content: {
          'application/json': {
            schema: z.object({
              email: z.string(),
              isConfirmed: z.boolean(),
              isUnsubscribed: z.boolean(),
              subscribedAt: z.string().nullable(),
            }),
          },
        },
      },
      ...errorResponses(404, 429),
    },
  }),
  async (c) => {
    const db = c.get('db')
    const { token } = c.req.valid('param')

    const sub = await getSubscriberByToken(db, token)
    if (!sub) {
      throw new HTTPException(404, { message: 'Subscription not found' })
    }

    return c.json({
      email: sub.email,
      isConfirmed: sub.isConfirmed || false,
      isUnsubscribed: sub.isUnsubscribed || false,
      subscribedAt: sub.subscribedAt?.toISOString() || null,
    })
  }
)

export { newsletterRouter }
