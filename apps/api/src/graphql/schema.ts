import { createSchema } from 'graphql-yoga'
import { resolvers } from './resolvers'

const typeDefs = /* GraphQL */ `
  # ============================================================================
  # RELAY-STYLE PAGINATION
  # ============================================================================

  interface Node {
    id: ID!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # ============================================================================
  # DOCUMENT TYPES
  # ============================================================================

  enum DocumentStatus {
    DRAFT
    PUBLISHED
  }

  type Document implements Node {
    id: ID!
    slug: String
    title: String
    subtitle: String
    status: DocumentStatus
    content: JSON
    markdown: String
    bannerImage: String
    scheduledDate: DateTime
    publishedDate: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
    # SEO metadata
    metaTitle: String
    metaDescription: String
    metaKeywords: String
    canonicalUrl: String
    ogImage: String
    # Reading info
    readingTime: String
    wordCount: String
    isFeatured: Boolean
  }

  type DocumentEdge {
    cursor: String!
    node: Document!
  }

  type DocumentConnection {
    edges: [DocumentEdge!]!
    nodes: [Document!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  # ============================================================================
  # CAMPAIGN TYPES
  # ============================================================================

  enum CampaignStatus {
    DRAFT
    SCHEDULED
    SENDING
    SENT
    FAILED
    CANCELLED
  }

  type Campaign implements Node {
    id: ID!
    title: String!
    slug: String!
    userId: String!
    documentId: String
    content: String
    status: CampaignStatus
    scheduledAt: DateTime
    sentAt: DateTime
    totalSent: String
    totalOpens: String
    totalClicks: String
    createdAt: DateTime
    updatedAt: DateTime
    # Relationships
    document: Document
    stats: CampaignStats
    linkClicks: [LinkClickStats!]!
  }

  type CampaignEdge {
    cursor: String!
    node: Campaign!
  }

  type CampaignConnection {
    edges: [CampaignEdge!]!
    nodes: [Campaign!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type CampaignStats {
    campaignId: String!
    totalSent: Int!
    totalClicks: Int!
    uniqueClicks: Int!
    totalUnsubscribes: Int!
    clickRate: Float!
    unsubscribeRate: Float!
  }

  type LinkClickStats {
    linkId: String!
    url: String!
    label: String
    clicks: Int!
  }

  # ============================================================================
  # SUBSCRIBER TYPES
  # ============================================================================

  type Subscriber implements Node {
    id: ID!
    email: String!
    token: String!
    subscribedAt: DateTime
    confirmedAt: DateTime
    unsubscribedAt: DateTime
    isConfirmed: Boolean!
    isUnsubscribed: Boolean!
  }

  type SubscriberEdge {
    cursor: String!
    node: Subscriber!
  }

  type SubscriberConnection {
    edges: [SubscriberEdge!]!
    nodes: [Subscriber!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type SubscriberStats {
    total: Int!
    confirmed: Int!
    unsubscribed: Int!
    pending: Int!
  }

  # ============================================================================
  # CATEGORY & TAG TYPES
  # ============================================================================

  type Category implements Node {
    id: ID!
    name: String!
    slug: String!
    description: String
    color: String
    parentId: String
    createdAt: DateTime
    updatedAt: DateTime
  }

  type Tag implements Node {
    id: ID!
    name: String!
    slug: String!
    usageCount: String
    createdAt: DateTime
  }

  # ============================================================================
  # USER TYPES
  # ============================================================================

  type User implements Node {
    id: ID!
    name: String!
    email: String!
    emailVerified: Boolean!
    image: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # ============================================================================
  # NEWSLETTER TYPES
  # ============================================================================

  type NewsletterSettings {
    id: ID!
    newsletterName: String!
    confirmationUrl: String
    fromName: String!
    logoUrl: String
    brandColor: String
    isActive: Boolean!
    createdAt: DateTime
    updatedAt: DateTime
  }

  type SubscriptionResult {
    success: Boolean!
    message: String
  }

  type UnsubscribeResult {
    success: Boolean!
  }

  type ConfirmationResult {
    success: Boolean!
    message: String
  }

  type SubscriptionStatus {
    email: String!
    isConfirmed: Boolean!
    isUnsubscribed: Boolean!
    subscribedAt: DateTime
  }

  # ============================================================================
  # UPLOAD TYPES
  # ============================================================================

  type UploadResult {
    url: String!
    key: String!
    filename: String!
    originalFilename: String!
    contentType: String!
    fileSize: Int!
    uploadedBy: String!
    uploadedAt: String!
  }

  type PreSignedUrlResult {
    preSignedUrl: String!
    filename: String!
    fileSize: Int!
    contentType: String!
    expiresIn: Int!
    originalFilename: String!
    uploadedBy: String!
    uploadedAt: String!
  }

  # ============================================================================
  # CUSTOM SCALARS
  # ============================================================================

  scalar DateTime
  scalar JSON

  # ============================================================================
  # INPUT TYPES
  # ============================================================================

  input DocumentFilterInput {
    status: DocumentStatus
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  input CreateDocumentInput {
    title: String
    subtitle: String
    status: DocumentStatus
    content: JSON
    markdown: String
    bannerImage: String
    scheduledDate: DateTime
    publishedDate: DateTime
  }

  input UpdateDocumentInput {
    id: ID!
    title: String
    subtitle: String
    status: DocumentStatus
    content: JSON
    markdown: String
    bannerImage: String
    scheduledDate: DateTime
    publishedDate: DateTime
  }

  input CreateCampaignInput {
    title: String!
    documentId: String
    content: String
    scheduledAt: DateTime
  }

  input SendCampaignInput {
    campaignId: ID!
    documentId: String!
  }

  input ScheduleCampaignInput {
    campaignId: ID!
    documentId: String!
    scheduledAt: DateTime!
  }

  input SubscribeInput {
    email: String!
    sendConfirmation: Boolean
  }

  input UnsubscribeInput {
    token: String!
    reason: String
    campaignId: String
  }

  input ConfirmSubscriptionInput {
    token: String!
  }

  input PreSignedUrlInput {
    filename: String!
    fileSize: Int!
    contentType: String!
  }

  # ============================================================================
  # QUERY TYPE
  # ============================================================================

  type Query {
    # Node interface
    node(id: ID!): Node

    # Documents (authenticated)
    documents(
      filter: DocumentFilterInput
      pagination: PaginationInput
    ): DocumentConnection!

    document(id: ID!): Document

    # Posts (public)
    post(id: ID!): Document
    postBySlug(slug: String!): Document
    publishedPosts(first: Int): [Document!]!

    # Campaigns (authenticated)
    campaigns(pagination: PaginationInput): CampaignConnection!
    campaign(id: ID!): Campaign
    campaignStats(id: ID!): CampaignStats
    campaignLinkClicks(id: ID!): [LinkClickStats!]!

    # Subscribers (authenticated)
    subscriberStats: SubscriberStats!

    # Newsletter (public)
    subscriptionStatus(token: String!): SubscriptionStatus

    # User
    me: User
  }

  # ============================================================================
  # MUTATION TYPE
  # ============================================================================

  type Mutation {
    # Documents
    createDocument(input: CreateDocumentInput!): Document!
    updateDocument(input: UpdateDocumentInput!): Document!
    deleteDocument(id: ID!): Boolean!
    updateDocumentBanner(id: ID!, bannerImage: String!): Document!

    # Campaigns
    createCampaign(input: CreateCampaignInput!): Campaign!
    sendCampaign(input: SendCampaignInput!): SubscriptionResult!
    scheduleCampaign(input: ScheduleCampaignInput!): SubscriptionResult!
    deleteCampaign(id: ID!): Boolean!

    # Newsletter
    subscribe(input: SubscribeInput!): SubscriptionResult!
    unsubscribe(input: UnsubscribeInput!): UnsubscribeResult!
    confirmSubscription(input: ConfirmSubscriptionInput!): ConfirmationResult!

    # Uploads
    generatePreSignedUrl(input: PreSignedUrlInput!): PreSignedUrlResult!
  }
`

export const schema = createSchema({
  typeDefs,
  resolvers,
})
