import { GraphQLError } from 'graphql'
import { eq } from 'drizzle-orm'

import { subscribers, type Subscriber } from '@api/db/schema'
import { generateId } from '@api/lib/utils'
import type { GraphQLContext } from '../context'
import { requireAuth } from '../context'

type SubscribeInput = {
  email: string
  sendConfirmation?: boolean
}

type UnsubscribeInput = {
  token: string
  reason?: string
  campaignId?: string
}

type ConfirmSubscriptionInput = {
  token: string
}

async function getSubscriberByEmail(db: any, email: string, writerId: string) {
  const [subscriber] = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.email, email))
    .limit(1)

  return subscriber
}

async function getSubscriberByToken(db: any, token: string) {
  const [subscriber] = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.token, token))
    .limit(1)

  return subscriber
}

export const newsletterResolvers = {
  Query: {
    subscriptionStatus: async (_: unknown, args: { token: string }, context: GraphQLContext) => {
      const subscriber = await getSubscriberByToken(context.db, args.token)

      if (!subscriber) {
        throw new GraphQLError('Subscription not found', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      return {
        email: subscriber.email,
        isConfirmed: subscriber.isConfirmed ?? false,
        isUnsubscribed: subscriber.isUnsubscribed ?? false,
        subscribedAt: subscriber.subscribedAt,
      }
    },
  },

  Mutation: {
    subscribe: async (_: unknown, args: { input: SubscribeInput }, context: GraphQLContext) => {
      requireAuth(context)

      const { db, session } = context
      const { email, sendConfirmation = true } = args.input
      const writerId = session!.user.id

      // Check if subscriber already exists
      const existing = await getSubscriberByEmail(db, email, writerId)

      if (existing) {
        if (existing.isUnsubscribed) {
          // Re-subscribe
          await db
            .update(subscribers)
            .set({
              isUnsubscribed: false,
              unsubscribedAt: null,
              isConfirmed: false,
            })
            .where(eq(subscribers.id, existing.id))

          return { success: true, message: 'Re-subscribed successfully' }
        }

        if (existing.isConfirmed) {
          return { success: true, message: 'Already subscribed' }
        }

        return { success: true, message: 'Confirmation pending' }
      }

      // Create new subscriber
      const token = generateId('sub')

      await db.insert(subscribers).values({
        id: generateId(),
        email,
        token,
        writerId,
        isConfirmed: false,
        isUnsubscribed: false,
      })

      // TODO: Send confirmation email if sendConfirmation is true

      return {
        success: true,
        message: sendConfirmation
          ? 'Please check your email to confirm subscription'
          : 'Subscribed successfully',
      }
    },

    unsubscribe: async (_: unknown, args: { input: UnsubscribeInput }, context: GraphQLContext) => {
      const { db } = context
      const { token, reason, campaignId } = args.input

      const subscriber = await getSubscriberByToken(db, token)

      if (!subscriber) {
        throw new GraphQLError('Subscription not found', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      if (subscriber.isUnsubscribed) {
        return { success: true }
      }

      await db
        .update(subscribers)
        .set({
          isUnsubscribed: true,
          unsubscribedAt: new Date(),
        })
        .where(eq(subscribers.id, subscriber.id))

      // TODO: Record unsubscribe event with reason and campaignId

      return { success: true }
    },

    confirmSubscription: async (
      _: unknown,
      args: { input: ConfirmSubscriptionInput },
      context: GraphQLContext
    ) => {
      const { db } = context
      const { token } = args.input

      const subscriber = await getSubscriberByToken(db, token)

      if (!subscriber) {
        throw new GraphQLError('Subscription not found', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      if (subscriber.isConfirmed) {
        return { success: true, message: 'Already confirmed' }
      }

      if (subscriber.isUnsubscribed) {
        throw new GraphQLError('Subscription has been cancelled', {
          extensions: { code: 'BAD_REQUEST' },
        })
      }

      await db
        .update(subscribers)
        .set({
          isConfirmed: true,
          confirmedAt: new Date(),
        })
        .where(eq(subscribers.id, subscriber.id))

      return { success: true, message: 'Subscription confirmed' }
    },
  },
}
