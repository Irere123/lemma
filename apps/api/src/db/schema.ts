import {
  foreignKey,
  index,
  integer,
  sqliteTable,
  sqliteTableCreator,
  text,
  unique,
} from 'drizzle-orm/sqlite-core'

export const createTable = sqliteTableCreator((name) => name)

// ============================================================================
// AUTHENTICATION & USER MANAGEMENT
// ============================================================================

export const user = sqliteTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('email_verified', { mode: 'boolean' })
      .$defaultFn(() => false)
      .notNull(),
    image: text('image'),
    username: text('username').unique(),
    bio: text('bio'),
    website: text('website'),
    location: text('location'),
    socialLinks: text('social_links', { mode: 'json' }).$type<{
      twitter?: string
      github?: string
      linkedin?: string
      website?: string
    }>(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('user_username_idx').on(table.username)]
)

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
})

// ============================================================================
// DOCUMENTS & CONTENT MANAGEMENT
// ============================================================================

// Note: Status values stored as text. Historical typo in the PG enum name
// ('document_staus') is irrelevant on SQLite — the column is a plain text enum.
export const documentStatus = ['DRAFT', 'PUBLISHED'] as const

export const documents = createTable(
  'documents',
  {
    id: text('id').primaryKey(),
    slug: text('slug'),
    title: text('title'),
    subtitle: text('subtitle'),
    status: text('status', { enum: documentStatus }),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    markdown: text('markdown'),
    bannerImage: text('banner_image'),
    scheduledDate: integer('scheduled_date', { mode: 'timestamp' }),
    publishedDate: integer('published_date', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    // SEO metadata
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    metaKeywords: text('meta_keywords'),
    canonicalUrl: text('canonical_url'),
    ogImage: text('og_image'),
    // Reading time and word count
    readingTime: text('reading_time'),
    wordCount: text('word_count'),
    // Featured flag
    isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),
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
export type DocumentStatus = (typeof documentStatus)[number]

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
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
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
    usageCount: text('usage_count').default('0'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
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
// COMMENTS & LIKES
// ============================================================================

// Comments with nested reply support (adjacency list pattern)
export const comments = createTable(
  'comments',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'), // Self-reference for nested replies
    content: text('content').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (table) => [
    index('comments_document_id_idx').on(table.documentId),
    index('comments_user_id_idx').on(table.userId),
    index('comments_parent_id_idx').on(table.parentId),
    index('comments_created_at_idx').on(table.createdAt),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: 'comments_parent_id_fkey',
    }).onDelete('cascade'),
  ]
)

export type Comment = typeof comments.$inferSelect
export type CommentInsert = typeof comments.$inferInsert

// Document likes (unique per user + document)
export const documentLikes = createTable(
  'document_likes',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (table) => [
    index('document_likes_document_id_idx').on(table.documentId),
    index('document_likes_user_id_idx').on(table.userId),
    unique('document_likes_unique').on(table.documentId, table.userId),
  ]
)

export type DocumentLike = typeof documentLikes.$inferSelect
export type DocumentLikeInsert = typeof documentLikes.$inferInsert

// Social graph: user -> user follows (unique per follower + following)
export const follows = createTable(
  'follows',
  {
    id: text('id').primaryKey(),
    followerId: text('follower_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    followingId: text('following_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (table) => [
    index('follows_following_id_idx').on(table.followingId),
    index('follows_follower_id_idx').on(table.followerId),
    unique('follows_unique').on(table.followerId, table.followingId),
  ]
)

export type Follow = typeof follows.$inferSelect
export type FollowInsert = typeof follows.$inferInsert

// ============================================================================
// NEWSLETTER & EMAIL
// ============================================================================

export const subscribers = createTable(
  'subscribers',
  {
    id: text().primaryKey(),
    email: text().notNull(),
    token: text().notNull().unique(),
    writerId: text('writer_id').references(() => user.id, {
      onDelete: 'cascade',
    }),
    subscribedAt: integer('subscribed_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
    unsubscribedAt: integer('unsubscribed_at', { mode: 'timestamp' }),
    isConfirmed: integer('is_confirmed', { mode: 'boolean' }).default(false),
    isUnsubscribed: integer('is_unsubscribed', { mode: 'boolean' }).default(false),
  },
  (table) => [
    index('email_idx').on(table.email),
    index('token_idx').on(table.token),
    index('confirmed_idx').on(table.isConfirmed),
    index('writer_id_idx').on(table.writerId),
    // One subscriber email per writer (supports subscribing to many writers).
    unique('sub_writer_email').on(table.writerId, table.email),
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
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
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

export const campaignStatus = [
  'DRAFT',
  'SCHEDULED',
  'SENDING',
  'SENT',
  'FAILED',
  'CANCELLED',
] as const

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
    status: text({ enum: campaignStatus }).default('DRAFT'),
    scheduledAt: integer('scheduled_at', { mode: 'timestamp' }),
    sentAt: integer('sent_at', { mode: 'timestamp' }),
    totalSent: text('total_sent').default('0'),
    totalOpens: text('total_opens').default('0'),
    totalClicks: text('total_clicks').default('0'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    // A/B Testing fields
    isAbTest: integer('is_ab_test', { mode: 'boolean' }).default(false),
    parentCampaignId: text('parent_campaign_id'),
    variantName: text('variant_name'),
    variantPercentage: text('variant_percentage'),
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
export type CampaignStatus = (typeof campaignStatus)[number]

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
    clickedAt: integer('clicked_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
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
    openedAt: integer('opened_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
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
    unsubscribedAt: integer('unsubscribed_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    reason: text(),
  },
  (table) => [
    index('sub_rel_id_idx').on(table.subscriberId),
    index('camp_rel_id_idx').on(table.campaignId),
  ]
)

export type UnSubscribeEvent = typeof unsubscribeEvents.$inferSelect
export type UnSubscribeEventInsert = typeof unsubscribeEvents.$inferInsert

// Per-subscriber delivery ledger. Guarantees a newsletter send is idempotent:
// a retried/duplicated batch job can claim each (campaignId, subscriberId) pair
// exactly once, so subscribers never receive the same campaign twice. campaignId
// is a plain text column (not an FK) because A/B variants use a suffixed id.
export const newsletterDeliveries = createTable(
  'newsletter_deliveries',
  {
    id: text('id').primaryKey(),
    campaignId: text('campaign_id').notNull(),
    subscriberId: text('subscriber_id')
      .notNull()
      .references(() => subscribers.id, { onDelete: 'cascade' }),
    deliveredAt: integer('delivered_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (table) => [
    index('newsletter_deliveries_campaign_idx').on(table.campaignId),
    index('newsletter_deliveries_subscriber_idx').on(table.subscriberId),
    unique('newsletter_deliveries_unique').on(table.campaignId, table.subscriberId),
  ]
)

export type NewsletterDelivery = typeof newsletterDeliveries.$inferSelect
export type NewsletterDeliveryInsert = typeof newsletterDeliveries.$inferInsert

// ============================================================================
// WORKSPACES & MULTI-TENANCY
// ============================================================================

export const workspaceRole = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'] as const

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
    settings: text('settings', { mode: 'json' }).$type<{
      allowPublicSignup?: boolean
      defaultRole?: 'EDITOR' | 'VIEWER'
      brandColor?: string
      customCss?: string
    }>(),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
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
    role: text('role', { enum: workspaceRole }).default('VIEWER'),
    invitedBy: text('invited_by').references(() => user.id),
    invitedAt: integer('invited_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    joinedAt: integer('joined_at', { mode: 'timestamp' }),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
  },
  (table) => [
    index('workspace_members_workspace_id_idx').on(table.workspaceId),
    index('workspace_members_user_id_idx').on(table.userId),
    unique('workspace_members_unique').on(table.workspaceId, table.userId),
  ]
)

export type WorkspaceMember = typeof workspaceMembers.$inferSelect
export type WorkspaceMemberInsert = typeof workspaceMembers.$inferInsert
export type WorkspaceRole = (typeof workspaceRole)[number]

export const workspaceInvites = createTable(
  'workspace_invites',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role', { enum: workspaceRole }).default('VIEWER'),
    token: text('token').notNull().unique(),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => user.id),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    acceptedAt: integer('accepted_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
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

export const apiKeys = sqliteTable(
  'api_keys',
  {
    id: text('id').notNull().primaryKey(),
    keyEncrypted: text('key_encrypted').notNull(),
    name: text('name').notNull(),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    userId: text('user_id').notNull(),
    keyHash: text('key_hash'),
    scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull().default([]),
    lastUsedAt: text('last_used_at'),
  },
  (table) => [
    index('api_keys_key_idx').on(table.keyHash),
    index('api_keys_user_id_idx').on(table.userId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'api_keys_api_user_fkey',
    }).onDelete('cascade'),
    unique('api_keys_key_unique').on(table.keyHash),
  ]
)

// ============================================================================
// OAUTH
// ============================================================================

// OAuth applications
export const oauthApplications = sqliteTable(
  'oauth_applications',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    overview: text('overview'),
    logoUrl: text('logo_url'),
    website: text('website'),
    installUrl: text('install_url'),
    screenshots: text('screenshots', { mode: 'json' }).$type<string[]>().notNull().default([]),
    redirectUris: text('redirect_uris', { mode: 'json' }).$type<string[]>().notNull().default([]),
    clientId: text('client_id').notNull(),
    clientSecret: text('client_secret').notNull(),
    scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull().default([]),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'cascade' }),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    isPublic: integer('is_public', { mode: 'boolean' }).default(false),
    active: integer('active', { mode: 'boolean' }).default(true),
    status: text('status', { enum: ['draft', 'pending', 'approved', 'rejected'] }).default('draft'),
  },
  (table) => [
    index('oauth_applications_client_id_idx').on(table.clientId),
    index('oauth_applications_slug_idx').on(table.slug),
  ]
)

// OAuth Authorization codes
export const oauthAuthorizationCodes = sqliteTable(
  'oauth_authorization_codes',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    applicationId: text('application_id').notNull(),
    userId: text('user_id').notNull(),
    scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull(),
    redirectUri: text('redirect_uri').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    used: integer('used', { mode: 'boolean' }).default(false),
    codeChallenge: text('code_challenge'),
    codeChallengeMethod: text('code_challenge_method'),
  },
  (table) => [
    index('oauth_authorization_codes_code_idx').on(table.code),
    index('oauth_authorization_codes_application_id_idx').on(table.applicationId),
    index('oauth_authorization_codes_user_id_idx').on(table.userId),
    foreignKey({
      columns: [table.applicationId],
      foreignColumns: [oauthApplications.id],
      name: 'oauth_authorization_codes_application_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'oauth_authorization_codes_user_id_fkey',
    }).onDelete('cascade'),
  ]
)

// OAuth Access Tokens
export const oauthAccessTokens = sqliteTable(
  'oauth_access_tokens',
  {
    id: text('id').notNull().primaryKey(),
    token: text('token').notNull().unique(),
    refreshToken: text('refresh_token').unique(),
    applicationId: text('application_id').notNull(),
    userId: text('user_id').notNull(),
    scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull(),
    expiresAt: text('expires_at').notNull(),
    refreshTokenExpiresAt: text('refresh_token_expires_at'),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    lastUsedAt: text('last_used_at'),
    revoked: integer('revoked', { mode: 'boolean' }).default(false),
    revokedAt: text('revoked_at'),
  },
  (table) => [
    index('oauth_access_tokens_token_idx').on(table.token),
    index('oauth_access_tokens_refresh_token_idx').on(table.refreshToken),
    index('oauth_access_tokens_application_id_idx').on(table.applicationId),
    index('oauth_access_tokens_user_id_idx').on(table.userId),
    foreignKey({
      columns: [table.applicationId],
      foreignColumns: [oauthApplications.id],
      name: 'oauth_access_tokens_application_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'oauth_access_tokens_user_id_fkey',
    }).onDelete('cascade'),
  ]
)
