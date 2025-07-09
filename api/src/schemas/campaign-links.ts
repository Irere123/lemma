import { index, pgTable, text } from "drizzle-orm/pg-core";
import { campaigns } from "./campaigns";

export const campaignLinks = pgTable(
  "campaign_links",
  {
    id: text().primaryKey(),
    campaignId: text("campaign_id")
      .references(() => campaigns.id, { onDelete: "cascade" })
      .notNull(),
    url: text().notNull(),
    label: text(),
  },
  (table) => [index("campaign_link_id_idx").on(table.campaignId)]
);

export type CampaignLink = typeof campaignLinks.$inferSelect;
export type CampignLinkInsert = typeof campaignLinks.$inferInsert;
