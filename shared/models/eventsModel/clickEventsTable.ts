import { index, inet, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { subscribers } from "../subscriberModel/subscriberTable.js";
import { campaignLinks } from "../campaignModel/campaignLinksTable.js";

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
