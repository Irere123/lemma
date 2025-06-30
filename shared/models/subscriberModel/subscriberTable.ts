import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export const subscribers = pgTable(
  "subscribers",
  {
    id: text().primaryKey(),
    email: varchar().notNull(),
    token: text().notNull(),
    subscribedAt: timestamp("subscribed_at", {
      withTimezone: true,
    }).defaultNow(),
    confirmedAt: timestamp("confirmed_at"),
    unsubscribedAt: timestamp("unsubscribed_at"),
    isConfirmed: boolean("is_confirmed").default(false),
    isUnsubscribed: boolean("is_unsubscribed").default(false),
  },
  (table) => [
    index("email_idx").on(table.email),
    index("token_idx").on(table.token),
    index("confirmed_idx").on(table.isConfirmed),
    unique("unique_subscriber_constraint").on(table.email, table.token),
  ]
);

export type Subscriber = typeof subscribers.$inferSelect;
export type SubscriberInsert = typeof subscribers.$inferInsert;
