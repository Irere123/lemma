import { and, eq } from "drizzle-orm";
import type { DB } from "@api/db";
import { subscribers, type Subscriber } from "@api/db/schema";

/**
 * Get all confirmed and active subscribers
 */
export const getConfirmedSubscribers = async (
  db: DB
): Promise<Subscriber[]> => {
  const confirmedSubscribers = await db
    .select()
    .from(subscribers)
    .where(
      and(
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
