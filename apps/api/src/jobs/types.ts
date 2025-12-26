// Email Job Types
export type EmailJobType =
  | 'send-single-email'
  | 'send-batch-email'
  | 'send-welcome-email'
  | 'send-confirmation-email'
  | 'send-newsletter'

export interface SendSingleEmailJob {
  type: 'send-single-email'
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

export interface SendBatchEmailJob {
  type: 'send-batch-email'
  emails: Array<{
    to: string
    subject: string
    html: string
    text?: string
  }>
}

export interface SendWelcomeEmailJob {
  type: 'send-welcome-email'
  subscriberId: string
  email: string
  token: string
  writerId: string
  writerSettings: {
    id: string
    newsletterName: string
    fromName: string
    logoUrl: string | null
    brandColor: string | null
    confirmationUrl: string | null
  }
}

export interface SendConfirmationEmailJob {
  type: 'send-confirmation-email'
  subscriberId: string
  email: string
  token: string
  writerId: string
  writerSettings: {
    id: string
    newsletterName: string
    fromName: string
    logoUrl: string | null
    brandColor: string | null
    confirmationUrl: string | null
  }
}

export interface SendNewsletterJob {
  type: 'send-newsletter'
  campaignId: string
  documentId: string
  writerId: string
  subscriberIds?: string[] // If not provided, send to all confirmed subscribers
  scheduledAt?: Date
}

export type EmailJobData =
  | SendSingleEmailJob
  | SendBatchEmailJob
  | SendWelcomeEmailJob
  | SendConfirmationEmailJob
  | SendNewsletterJob

// Newsletter Job Types
export type NewsletterJobType = 'process-newsletter-batch' | 'schedule-newsletter' | 'send-ab-test'

export interface ProcessNewsletterBatchJob {
  type: 'process-newsletter-batch'
  campaignId: string
  documentId: string
  writerId: string
  subscriberBatch: string[] // Array of subscriber IDs
  batchIndex: number
  totalBatches: number
  templateId?: string
}

export interface ScheduleNewsletterJob {
  type: 'schedule-newsletter'
  campaignId: string
  documentId: string
  writerId: string
  scheduledAt: string // ISO date string
}

export interface SendABTestJob {
  type: 'send-ab-test'
  campaignId: string
  variants: Array<{
    variantId: string
    documentId: string
    percentage: number
  }>
  writerId: string
  testDurationHours: number
}

export type NewsletterJobData = ProcessNewsletterBatchJob | ScheduleNewsletterJob | SendABTestJob

// Analytics Job Types
export type AnalyticsJobType = 'track-click' | 'track-open' | 'aggregate-campaign-stats'

export interface TrackClickJob {
  type: 'track-click'
  subscriberId: string
  linkId: string
  campaignId: string
  userAgent?: string
  ipAddress?: string
}

export interface TrackOpenJob {
  type: 'track-open'
  subscriberId: string
  campaignId: string
  userAgent?: string
  ipAddress?: string
}

export interface AggregateCampaignStatsJob {
  type: 'aggregate-campaign-stats'
  campaignId: string
}

export type AnalyticsJobData = TrackClickJob | TrackOpenJob | AggregateCampaignStatsJob

// Scheduled Job Types
export type ScheduledJobType = 'publish-scheduled-document' | 'send-scheduled-newsletter'

export interface PublishScheduledDocumentJob {
  type: 'publish-scheduled-document'
  documentId: string
}

export interface SendScheduledNewsletterJob {
  type: 'send-scheduled-newsletter'
  campaignId: string
  documentId: string
  writerId: string
}

export type ScheduledJobData = PublishScheduledDocumentJob | SendScheduledNewsletterJob

// Union of all job data types
export type JobData = EmailJobData | NewsletterJobData | AnalyticsJobData | ScheduledJobData
