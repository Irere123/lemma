/**
 * Shared contracts for the realtime (Durable Object backed) layer.
 *
 * These shapes are sent verbatim over the WebSocket to the dashboard, so the
 * web app mirrors them in `apps/web/src/lib/realtime/*`. Keep the two in sync.
 */

export type CampaignSendStatus = 'idle' | 'sending' | 'sent' | 'failed'

export type EngagementKind = 'open' | 'click' | 'unsubscribe'

/** Live view of a single campaign's send + engagement, pushed as it changes. */
export interface CampaignProgressSnapshot {
  campaignId: string | null
  status: CampaignSendStatus
  totalRecipients: number
  sentCount: number
  totalBatches: number
  batchesDone: number
  opens: number
  clicks: number
  unsubscribes: number
  startedAt: number | null
  completedAt: number | null
}

/** Live subscriber counts for a writer's dashboard. */
export interface SubscriberStatsSnapshot {
  total: number
  confirmed: number
  pending: number
  unsubscribed: number
}

/** Server -> client messages on the per-campaign channel. */
export type CampaignChannelMessage =
  | { type: 'campaign'; data: CampaignProgressSnapshot }
  | { type: 'pong' }

/** Server -> client messages on the per-writer subscribers channel. */
export type SubscriberChannelMessage =
  | { type: 'subscribers'; data: SubscriberStatsSnapshot }
  | { type: 'pong' }
