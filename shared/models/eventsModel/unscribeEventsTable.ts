import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { subscribers } from "../subscriberModel/subscriberTable.js";
import { campaigns } from "../campaignModel/campaignTable.js";

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
    index("subscriber_id_idx").on(table.subscriberId),
    index("campaign_id_idx").on(table.campaignId),
  ]
);
