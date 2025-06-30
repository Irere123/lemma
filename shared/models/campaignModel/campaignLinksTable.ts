import { index, pgTable, text } from "drizzle-orm/pg-core";
import { campaigns } from "./campaignTable.js";

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
  (table) => [index("campaign_id_idx").on(table.campaignId)]
);
