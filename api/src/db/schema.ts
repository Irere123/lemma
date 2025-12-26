import { sql } from 'drizzle-orm'
import {
  boolean,
  foreignKey,
  index,
  inet,
  jsonb,
  pgEnum,
  pgTable,
  pgTableCreator,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

export const createTable = pgTableCreator((name) => `brainos_${name}`)

// ============================================================================
// AUTHENTICATION & USER MANAGEMENT
// ============================================================================

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified')
    .$defaultFn(() => false)
    .notNull(),
  image: text('image'),
  createdAt: timestamp('created_at')
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => /* @__PURE__ */ new Date()),
})

// ============================================================================
// DOCUMENTS & CONTENT MANAGEMENT
// ============================================================================

// Note: Enum name has a typo in the database ('document_staus'), keeping it for compatibility
export const documentStatusEnum = pgEnum('document_staus', ['DRAFT', 'PUBLISHED'])

export const documents = createTable(
  'documents',
  {
    id: text('id').primaryKey(),
    slug: text('slug'),
    title: text('title'),
    subtitle: text('subtitle'),
    status: documentStatusEnum(),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    content: jsonb('content').$type<any>(),
    markdown: text('markdown'),
    bannerImage: text('banner_image'),
    scheduledDate: timestamp('scheduled_date'),
    publishedDate: timestamp('published_date'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    // SEO metadata
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    metaKeywords: text('meta_keywords'),
    canonicalUrl: text('canonical_url'),
    ogImage: text('og_image'),
    // Reading time and word count
    readingTime: varchar('reading_time'),
    wordCount: varchar('word_count'),
    // Featured flag
    isFeatured: boolean('is_featured').default(false),
  },
  (table) => [
    index('documents_user_id_idx').on(table.userId),
    index('documents_status_idx').on(table.status),
    index('documents_created_at_idx').on(table.createdAt),
    index('documents_scheduled_date_idx').on(table.scheduledDate),
    index('documents_user_status_idx').on(table.userId, table.status),
    index('documents_featured_idx').on(table.isFeatured),
    unique('documents_slug_unique').on(table.slug),
  ]
)

export type Document = typeof documents.$inferSelect
export type DocumentInsert = typeof documents.$inferInsert
export type DocumentStatus = (typeof documentStatusEnum.enumValues)[number]

// Categories
export const categories = createTable(
  'categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    color: text('color').default('#6366f1'),
    writerId: text('writer_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'), // For hierarchical categories
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('categories_writer_id_idx').on(table.writerId),
    index('categories_slug_idx').on(table.slug),
    unique('categories_writer_slug_unique').on(table.writerId, table.slug),
  ]
)

export type Category = typeof categories.$inferSelect
export type CategoryInsert = typeof categories.$inferInsert

export const documentCategories = createTable(
  'document_categories',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('doc_categories_doc_id_idx').on(table.documentId),
    index('doc_categories_cat_id_idx').on(table.categoryId),
    unique('doc_categories_unique').on(table.documentId, table.categoryId),
  ]
)

export type DocumentCategory = typeof documentCategories.$inferSelect
export type DocumentCategoryInsert = typeof documentCategories.$inferInsert

// Tags
export const tags = createTable(
  'tags',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    writerId: text('writer_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    usageCount: varchar('usage_count').default('0'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('tags_writer_id_idx').on(table.writerId),
    index('tags_slug_idx').on(table.slug),
    unique('tags_writer_slug_unique').on(table.writerId, table.slug),
  ]
)

export type Tag = typeof tags.$inferSelect
export type TagInsert = typeof tags.$inferInsert

export const documentTags = createTable(
  'document_tags',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('doc_tags_doc_id_idx').on(table.documentId),
    index('doc_tags_tag_id_idx').on(table.tagId),
    unique('doc_tags_unique').on(table.documentId, table.tagId),
  ]
)

export type DocumentTag = typeof documentTags.$inferSelect
export type DocumentTagInsert = typeof documentTags.$inferInsert

// ============================================================================
// NEWSLETTER & EMAIL
// ============================================================================

export const subscribers = createTable(
  'subscribers',
  {
    id: text().primaryKey(),
    email: varchar().notNull().unique(),
    token: text().notNull().unique(),
    writerId: text('writer_id').references(() => user.id, {
      onDelete: 'cascade',
    }),
    subscribedAt: timestamp('subscribed_at', {
      withTimezone: true,
    }).defaultNow(),
    confirmedAt: timestamp('confirmed_at'),
    unsubscribedAt: timestamp('unsubscribed_at'),
    isConfirmed: boolean('is_confirmed').default(false),
    isUnsubscribed: boolean('is_unsubscribed').default(false),
  },
  (table) => [
    index('email_idx').on(table.email),
    index('token_idx').on(table.token),
    index('confirmed_idx').on(table.isConfirmed),
    index('writer_id_idx').on(table.writerId),
    unique('sub_constraint').on(table.email, table.token),
  ]
)

export type Subscriber = typeof subscribers.$inferSelect
export type SubscriberInsert = typeof subscribers.$inferInsert

export const newsletterSettings = createTable(
  'newsletter_settings',
  {
    id: text('id').primaryKey(),
    writerId: text('writer_id')
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    newsletterName: text('newsletter_name').notNull(),
    confirmationUrl: text('confirmation_url'),
    fromName: text('from_name').notNull(),
    logoUrl: text('logo_url'),
    brandColor: text('brand_color').default('#000000'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('writer_newsletter_writer_id_idx').on(table.writerId),
    index('writer_newsletter_active_idx').on(table.isActive),
  ]
)

export type NewsletterSettings = typeof newsletterSettings.$inferSelect
export type NewsletterSettingsInsert = typeof newsletterSettings.$inferInsert

// ============================================================================
// CAMPAIGNS & ANALYTICS
// ============================================================================

export const campaignStatusEnum = pgEnum('campaign_status', [
  'DRAFT',
  'SCHEDULED',
  'SENDING',
  'SENT',
  'FAILED',
  'CANCELLED',
])

export const campaigns = createTable(
  'campaigns',
  {
    id: text('id').primaryKey(),
    title: text().notNull(),
    slug: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    documentId: text('document_id').references(() => documents.id, { onDelete: 'set null' }),
    content: text(),
    status: campaignStatusEnum().default('DRAFT'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    totalSent: varchar('total_sent').default('0'),
    totalOpens: varchar('total_opens').default('0'),
    totalClicks: varchar('total_clicks').default('0'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    // A/B Testing fields
    isAbTest: boolean('is_ab_test').default(false),
    parentCampaignId: text('parent_campaign_id'),
    variantName: text('variant_name'),
    variantPercentage: varchar('variant_percentage'),
  },
  (table) => [
    index('campaigns_user_id_idx').on(table.userId),
    index('campaigns_status_idx').on(table.status),
    index('campaigns_scheduled_at_idx').on(table.scheduledAt),
    index('campaigns_parent_id_idx').on(table.parentCampaignId),
  ]
)

export type Campaign = typeof campaigns.$inferSelect
export type CampaignInsert = typeof campaigns.$inferInsert

export const campaignLinks = createTable(
  'campaign_links',
  {
    id: text().primaryKey(),
    campaignId: text('campaign_id')
      .references(() => campaigns.id, { onDelete: 'cascade' })
      .notNull(),
    url: text().notNull(),
    label: text(),
  },
  (table) => [index('camp_id_idx').on(table.campaignId)]
)

export type CampaignLink = typeof campaignLinks.$inferSelect
export type CampaignLinkInsert = typeof campaignLinks.$inferInsert

// Campaign Events
export const clickEvents = createTable(
  'click_events',
  {
    id: text('id').primaryKey(),
    subscriberId: text('subscriber_id').references(() => subscribers.id, {
      onDelete: 'cascade',
    }),
    linkId: text('link_id').references(() => campaignLinks.id, {
      onDelete: 'cascade',
    }),
    clickedAt: timestamp('clicked_at', { withTimezone: true }).notNull().defaultNow(),
    userAgent: text('user_agent'),
    ipAddress: inet('ip_address'),
  },
  (table) => [index('sub_id_idx').on(table.subscriberId), index('camp_ev_id_idx').on(table.linkId)]
)

export type ClickEvent = typeof clickEvents.$inferSelect
export type ClickEventInsert = typeof clickEvents.$inferInsert

export const openEvents = createTable(
  'open_events',
  {
    id: text('id').primaryKey(),
    subscriberId: text('subscriber_id').references(() => subscribers.id, {
      onDelete: 'cascade',
    }),
    campaignId: text('campaign_id').references(() => campaigns.id, {
      onDelete: 'cascade',
    }),
    openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow(),
    userAgent: text('user_agent'),
    ipAddress: inet('ip_address'),
  },
  (table) => [
    index('open_sub_id_idx').on(table.subscriberId),
    index('open_camp_id_idx').on(table.campaignId),
  ]
)

export type OpenEvent = typeof openEvents.$inferSelect
export type OpenEventInsert = typeof openEvents.$inferInsert

export const unsubscribeEvents = createTable(
  'unsubscribe_events',
  {
    id: text('id').primaryKey(),
    subscriberId: text('subscriber_id').references(() => subscribers.id, {
      onDelete: 'cascade',
    }),
    campaignId: text('campaign_id').references(() => campaigns.id, {
      onDelete: 'cascade',
    }),
    unsubscribedAt: timestamp('unsubscribed_at', {
      withTimezone: true,
    }).defaultNow(),
    reason: text(),
  },
  (table) => [
    index('sub_rel_id_idx').on(table.subscriberId),
    index('camp_rel_id_idx').on(table.campaignId),
  ]
)

export type UnSubscribeEvent = typeof unsubscribeEvents.$inferSelect
export type UnSubscribeEventInsert = typeof unsubscribeEvents.$inferInsert

// ============================================================================
// WORKSPACES & MULTI-TENANCY
// ============================================================================

export const workspaceRoleEnum = pgEnum('workspace_role', ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'])

export const workspaces = createTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    logoUrl: text('logo_url'),
    domain: text('domain'), // Custom domain for the workspace
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    settings: jsonb('settings').$type<{
      allowPublicSignup?: boolean
      defaultRole?: 'EDITOR' | 'VIEWER'
      brandColor?: string
      customCss?: string
    }>(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('workspaces_owner_id_idx').on(table.ownerId),
    index('workspaces_slug_idx').on(table.slug),
    index('workspaces_domain_idx').on(table.domain),
  ]
)

export type Workspace = typeof workspaces.$inferSelect
export type WorkspaceInsert = typeof workspaces.$inferInsert

export const workspaceMembers = createTable(
  'workspace_members',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: workspaceRoleEnum().default('VIEWER'),
    invitedBy: text('invited_by').references(() => user.id),
    invitedAt: timestamp('invited_at').defaultNow(),
    joinedAt: timestamp('joined_at'),
    isActive: boolean('is_active').default(true),
  },
  (table) => [
    index('workspace_members_workspace_id_idx').on(table.workspaceId),
    index('workspace_members_user_id_idx').on(table.userId),
    unique('workspace_members_unique').on(table.workspaceId, table.userId),
  ]
)

export type WorkspaceMember = typeof workspaceMembers.$inferSelect
export type WorkspaceMemberInsert = typeof workspaceMembers.$inferInsert
export type WorkspaceRole = (typeof workspaceRoleEnum.enumValues)[number]

export const workspaceInvites = createTable(
  'workspace_invites',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: workspaceRoleEnum().default('VIEWER'),
    token: text('token').notNull().unique(),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => user.id),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('workspace_invites_workspace_id_idx').on(table.workspaceId),
    index('workspace_invites_email_idx').on(table.email),
    index('workspace_invites_token_idx').on(table.token),
  ]
)

export type WorkspaceInvite = typeof workspaceInvites.$inferSelect
export type WorkspaceInviteInsert = typeof workspaceInvites.$inferInsert

// ============================================================================
// API KEYS
// ============================================================================

export const apiKeys = pgTable(
  'api_keys',
  {
    id: text('id').notNull().primaryKey(),
    keyEncrypted: text('key_encrypted').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    userId: text('user_id').notNull(),
    keyHash: text('key_hash'),
    scopes: text('scopes').array().notNull().default(sql`'{}'::text[]`),
    lastUsedAt: timestamp('last_used_at', {
      withTimezone: true,
      mode: 'string',
    }),
  },
  (table) => [
    index('api_keys_key_idx').using('btree', table.keyHash.asc().nullsLast().op('text_ops')),
    index('api_keys_user_id_idx').using('btree', table.userId.asc().nullsLast().op('text_ops')),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'api_keys_api_user_fkey',
    }).onDelete('cascade'),
    unique('api_keys_key_unique').on(table.keyHash),
  ]
)
