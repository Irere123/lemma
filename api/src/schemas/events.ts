import { index, inet, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { subscribers } from "./subscribers";
import { campaignLinks } from "./campaign-links";
import { campaigns } from "./campaigns";

export const clickEvents = pgTable(
  "click_events",
  {
    id: text("id").primaryKey(),
    subscriberId: text("subscriber_id").references(() => subscribers.id, {
      onDelete: "cascade",
    }),
    linkId: text("link_id").references(() => campaignLinks.id, {
      onDelete: "cascade",
    }),
    clickedAt: timestamp("clicked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    userAgent: text("user_agent"),
    ipAddress: inet("ip_address"),
  },
  (table) => [
    index("subscriber_id_idx").on(table.subscriberId),
    index("link_id_idx").on(table.linkId),
  ]
);

export const unsubscribeEvents = pgTable(
  "unsubscribe_events",
  {
    id: text("id").primaryKey(),
    subscriberId: text("subscriber_id").references(() => subscribers.id, {
      onDelete: "cascade",
    }),
    campaignId: text("campaign_id").references(() => campaigns.id, {
      onDelete: "cascade",
    }),
    unsubscribedAt: timestamp("unsubscribed_at", {
      withTimezone: true,
    }).defaultNow(),
    reason: text(),
  },
  (table) => [
    index("subscriber_rel_id_idx").on(table.subscriberId),
    index("campaign_rel_id_idx").on(table.campaignId),
  ]
);

// Types
export type UnSubscribeEvent = typeof unsubscribeEvents.$inferSelect;
export type ClickEvent = typeof clickEvents.$inferSelect;
export type UnSubscribeEventInsert = typeof unsubscribeEvents.$inferInsert;
export type ClickEventInsert = typeof clickEvents.$inferInsert;
