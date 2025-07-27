import {
  pgTableCreator,
  timestamp,
  index,
  pgTable,
  text,
  inet,
  varchar,
  boolean,
  unique,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `brainos_${name}`);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
});

export const subscribers = createTable(
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
    unique("sub_constraint").on(table.email, table.token),
  ]
);

export type Subscriber = typeof subscribers.$inferSelect;
export type SubscriberInsert = typeof subscribers.$inferInsert;

export const campaigns = createTable("campaigns", {
  id: text("id").primaryKey(),
  title: text().notNull(),
  slug: text().notNull(),
  userId: text().notNull(),
  content: text(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export type Campaign = typeof campaigns.$inferSelect;
export type CampaignInsert = typeof campaigns.$inferInsert;

export const campaignLinks = createTable(
  "campaign_links",
  {
    id: text().primaryKey(),
    campaignId: text("campaign_id")
      .references(() => campaigns.id, { onDelete: "cascade" })
      .notNull(),
    url: text().notNull(),
    label: text(),
  },
  (table) => [index("camp_id_idx").on(table.campaignId)]
);

export type CampaignLink = typeof campaignLinks.$inferSelect;
export type CampignLinkInsert = typeof campaignLinks.$inferInsert;

export const clickEvents = createTable(
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
    index("sub_id_idx").on(table.subscriberId),
    index("camp_ev_id_idx").on(table.linkId),
  ]
);

export const unsubscribeEvents = createTable(
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
    index("sub_rel_id_idx").on(table.subscriberId),
    index("camp_rel_id_idx").on(table.campaignId),
  ]
);

// Types
export type UnSubscribeEvent = typeof unsubscribeEvents.$inferSelect;
export type ClickEvent = typeof clickEvents.$inferSelect;
export type UnSubscribeEventInsert = typeof unsubscribeEvents.$inferInsert;
export type ClickEventInsert = typeof clickEvents.$inferInsert;
