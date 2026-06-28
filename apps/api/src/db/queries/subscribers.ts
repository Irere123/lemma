import { and, desc, eq } from 'drizzle-orm'

import type { DB } from '@api/db'
import { type Subscriber, subscribers } from '@api/db/schema'
import { generateId } from '@api/lib/utils'

// Types
export type UpsertSubscriber = {
  id?: string
  email: string
  token: string
  writerId: string | null
  subscribedAt?: Date
  unsubscribedAt?: Date
  confirmedAt?: Date
  isConfirmed?: boolean
  isUnsubscribed?: boolean
}

export const upsertSubscriber = async (db: DB, subscriber: UpsertSubscriber) => {
  if (subscriber.id) {
    const [result] = await db
      .update(subscribers)
      .set(subscriber)
      .where(eq(subscribers.id, subscriber.id))
      .returning()

    return result
  }

  const [result] = await db
    .insert(subscribers)
    .values({
      ...subscriber,
      id: generateId(),
    })
    .returning()
  return result
}

/**
 * Get confirmed and active subscribers for a specific writer
 */
export const getConfirmedSubscribers = async (db: DB, writerId: string): Promise<Subscriber[]> => {
  const confirmedSubscribers = await db
    .select()
    .from(subscribers)
    .where(
      and(
        eq(subscribers.writerId, writerId),
        eq(subscribers.isConfirmed, true),
        eq(subscribers.isUnsubscribed, false)
      )
    )

  return confirmedSubscribers
}

/**
 * List subscribers for a writer (most recent first), optionally filtered by state.
 */
export const getSubscribersByWriter = async (
  db: DB,
  writerId: string,
  options?: { limit?: number; status?: 'confirmed' | 'pending' | 'unsubscribed' }
): Promise<Subscriber[]> => {
  const limit = Math.min(options?.limit ?? 20, 100)

  const filters = [eq(subscribers.writerId, writerId)]
  if (options?.status === 'confirmed') {
    filters.push(eq(subscribers.isConfirmed, true), eq(subscribers.isUnsubscribed, false))
  } else if (options?.status === 'pending') {
    filters.push(eq(subscribers.isConfirmed, false), eq(subscribers.isUnsubscribed, false))
  } else if (options?.status === 'unsubscribed') {
    filters.push(eq(subscribers.isUnsubscribed, true))
  }

  return db
    .select()
    .from(subscribers)
    .where(and(...filters))
    .orderBy(desc(subscribers.subscribedAt))
    .limit(limit)
}

/**
 * Get a single subscriber scoped to a writer (ownership-safe lookup).
 */
export const getWriterSubscriberById = async (
  db: DB,
  id: string,
  writerId: string
): Promise<Subscriber | undefined> => {
  const [subscriber] = await db
    .select()
    .from(subscribers)
    .where(and(eq(subscribers.id, id), eq(subscribers.writerId, writerId)))
    .limit(1)

  return subscriber
}

/**
 * Permanently remove a subscriber row.
 */
export const deleteSubscriber = async (db: DB, id: string): Promise<void> => {
  await db.delete(subscribers).where(eq(subscribers.id, id))
}

/**
 * Get subscriber by email
 */
export const getSubscriberByEmail = async (
  db: DB,
  email: string
): Promise<Subscriber | undefined> => {
  const [subscriber] = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.email, email))
    .limit(1)

  return subscriber
}

/**
 * Get a subscriber scoped to a writer. Emails are unique per writer (not
 * globally), so subscribe/confirm flows must look up by (writerId, email).
 */
export const getSubscriberByWriterAndEmail = async (
  db: DB,
  writerId: string,
  email: string
): Promise<Subscriber | undefined> => {
  const [subscriber] = await db
    .select()
    .from(subscribers)
    .where(and(eq(subscribers.writerId, writerId), eq(subscribers.email, email)))
    .limit(1)

  return subscriber
}

/**
 * Get subscriber by token
 */
export const getSubscriberByToken = async (
  db: DB,
  token: string
): Promise<Subscriber | undefined> => {
  const [subscriber] = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.token, token))
    .limit(1)

  return subscriber
}

/**
 * Get count of confirmed subscribers
 */
export const getConfirmedSubscribersCount = async (db: DB): Promise<number> => {
  const result = await db
    .select()
    .from(subscribers)
    .where(and(eq(subscribers.isConfirmed, true), eq(subscribers.isUnsubscribed, false)))

  return result.length
}
