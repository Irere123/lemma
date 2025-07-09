import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  title: text().notNull(),
  slug: text().notNull(),
  userId: text().notNull(),
  content: text(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export type Campaign = typeof campaigns.$inferSelect;
export type CampaignInsert = typeof campaigns.$inferInsert;
