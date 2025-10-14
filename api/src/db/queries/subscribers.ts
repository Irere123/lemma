import { and, eq } from "drizzle-orm";
import type { DB } from "@api/db";
import { subscribers, type Subscriber } from "@api/db/schema";
import { generateId } from "@api/lib/utils";

// Types
export type UpsertSubscriber = {
  id?: string;
  email: string;
  token: string;
  writerId: string | null;
  subscribedAt?: Date;
  unsubscribedAt?: Date;
  confirmedAt?: Date;
  isConfirmed?: boolean;
  isUnsubscribed?: boolean;
};

export const upsertSubscriber = async (
  db: DB,
  subscriber: UpsertSubscriber
) => {
  if (subscriber.id) {
    const [result] = await db
      .update(subscribers)
      .set(subscriber)
      .where(eq(subscribers.id, subscriber.id))
      .returning();

    return result;
  }

  const [result] = await db
    .insert(subscribers)
    .values({
      ...subscriber,
      id: generateId(),
    })
    .returning();
  return result;
};

/**
 * Get confirmed and active subscribers for a specific writer
 */
export const getConfirmedSubscribers = async (
  db: DB,
  writerId: string
): Promise<Subscriber[]> => {
  const confirmedSubscribers = await db
    .select()
    .from(subscribers)
    .where(
      and(
        eq(subscribers.writerId, writerId),
        eq(subscribers.isConfirmed, true),
        eq(subscribers.isUnsubscribed, false)
      )
    );

  return confirmedSubscribers;
};

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
    .limit(1);

  return subscriber;
};

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
    .limit(1);

  return subscriber;
};

/**
 * Get count of confirmed subscribers
 */
export const getConfirmedSubscribersCount = async (db: DB): Promise<number> => {
  const result = await db
    .select()
    .from(subscribers)
    .where(
      and(
        eq(subscribers.isConfirmed, true),
        eq(subscribers.isUnsubscribed, false)
      )
    );

  return result.length;
};
