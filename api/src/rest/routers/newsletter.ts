import { createRoute, z } from '@hono/zod-openapi'

import { getWriterNewsletterSettings } from '@api/db/queries/newsletter-settings'
import {
  getSubscriberByEmail,
  getSubscriberByToken,
  upsertSubscriber,
} from '@api/db/queries/subscribers'
import { createRouter, generateId } from '@api/lib/utils'
import { withAuth } from '@api/rest/middleware/auth'
import { enqueueWelcomeEmail, enqueueConfirmationEmail } from '@api/jobs/producers'
import { unsubscribeEvents } from '@api/db/schema'

const newsletterRouter = createRouter()

// Subscribe
// Protected
// Send the api key or auth cookie when calling this endpoint
newsletterRouter.openapi(
  createRoute({
    method: 'post',
    path: '/subscribe',
    tags: ['Newsletter'],
    summary: 'Subscribe to newsletter (protected)',
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
      409: { description: 'Already subscribed' },
      404: { description: 'Writer newsletter settings not found' },
      500: { description: 'Internal error' },
    },
    middleware: [withAuth],
  }),
  async (c) => {
    const db = c.get('db')
    const session = c.get('session')
    const input = c.req.valid('json') as { email: string; sendConfirmation?: boolean }

    const existing = await getSubscriberByEmail(db, input.email)

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
      return c.json({ error: 'Already joined the newsletter.' }, 409)
    }

    try {
      const token = generateId('st')
      const writerSettings = await getWriterNewsletterSettings(db, session.user.id)

      if (!writerSettings) {
        return c.json({ error: 'Writer newsletter settings not found' }, 404)
      }

      const subCreated = await upsertSubscriber(db, {
        email: input.email,
        token,
        writerId: session.user.id,
      })

      // Send welcome email via job queue
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
    } catch (error) {
      console.error('Subscription error:', error)
      return c.json({ error: 'Something went wrong' }, 500)
    }
  }
)

// Unsubscribe
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
      404: { description: 'Subscription not found' },
      500: { description: 'Internal error' },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const input = c.req.valid('json') as { token: string; reason?: string; campaignId?: string }

    const sub = await getSubscriberByToken(db, input.token)
    if (!sub) {
      return c.json({ error: 'Subscription not found' }, 404)
    }

    try {
      // Update subscriber status
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
    } catch (error) {
      console.error('Unsubscribe error:', error)
      return c.json({ error: 'Something went wrong' }, 500)
    }
  }
)

// Confirm subscription
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
      404: { description: 'Subscription not found' },
      500: { description: 'Internal error' },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const input = c.req.valid('json') as { token: string }

    const sub = await getSubscriberByToken(db, input.token)
    if (!sub) {
      return c.json({ error: 'Subscription not found' }, 404)
    }

    if (sub.isConfirmed) {
      return c.json({ success: true, message: 'Already confirmed' })
    }

    try {
      await upsertSubscriber(db, {
        id: sub.id,
        isConfirmed: true,
        confirmedAt: new Date(),
        email: sub.email,
        token: sub.token,
        writerId: sub.writerId,
      })

      return c.json({ success: true, message: 'Subscription confirmed' })
    } catch (error) {
      console.error('Confirmation error:', error)
      return c.json({ error: 'Something went wrong' }, 500)
    }
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
      404: { description: 'Subscription not found' },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const { token } = c.req.valid('param')

    const sub = await getSubscriberByToken(db, token)
    if (!sub) {
      return c.json({ error: 'Subscription not found' }, 404)
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
