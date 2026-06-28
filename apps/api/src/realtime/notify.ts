import { getRuntimeBindings } from '@api/env-runtime'
import { logger } from '@api/lib/observability'
import type { EngagementKind } from './types'

/**
 * Best-effort notifiers used by the queue workers and tRPC handlers. Realtime is
 * a side channel: if the Durable Object binding is missing (e.g. a context
 * without DOs) or the RPC fails, we log and move on — it must never break a send
 * or a mutation.
 */

const log = logger.child({ component: 'realtime', subcomponent: 'notify' })

function campaignStub(campaignId: string) {
  return getRuntimeBindings().CAMPAIGN_PROGRESS?.getByName(campaignId) ?? null
}

function writerStub(writerId: string) {
  return getRuntimeBindings().WRITER_STATS?.getByName(writerId) ?? null
}

export async function notifyCampaignStart(
  campaignId: string,
  totalRecipients: number,
  totalBatches: number
): Promise<void> {
  const stub = campaignStub(campaignId)
  if (!stub) return
  try {
    await stub.start({ campaignId, totalRecipients, totalBatches })
  } catch (error) {
    log.warn('notifyCampaignStart failed', { campaignId, error: String(error) })
  }
}

export async function notifyBatchCompleted(
  campaignId: string,
  batchIndex: number,
  count: number
): Promise<void> {
  const stub = campaignStub(campaignId)
  if (!stub) return
  try {
    await stub.batchCompleted({ batchIndex, count })
  } catch (error) {
    log.warn('notifyBatchCompleted failed', { campaignId, batchIndex, error: String(error) })
  }
}

export async function notifyCampaignEngagement(
  campaignId: string,
  kind: EngagementKind,
  count = 1
): Promise<void> {
  const stub = campaignStub(campaignId)
  if (!stub) return
  try {
    await stub.recordEngagement({ kind, count })
  } catch (error) {
    log.warn('notifyCampaignEngagement failed', { campaignId, kind, error: String(error) })
  }
}

export async function notifyWriterStatsChanged(writerId: string): Promise<void> {
  const stub = writerStub(writerId)
  if (!stub) return
  try {
    await stub.notifyChange(writerId)
  } catch (error) {
    log.warn('notifyWriterStatsChanged failed', { writerId, error: String(error) })
  }
}
