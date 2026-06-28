import { createDb } from '@api/db'
import { clickEvents } from '@api/db/schema'
import { logger } from '@api/lib/observability'
import { generateId } from '@api/lib/utils'
import { notifyCampaignEngagement } from '@api/realtime/notify'
import { eq, sql } from 'drizzle-orm'

import type {
  AggregateCampaignStatsJob,
  AnalyticsJobData,
  TrackClickJob,
  TrackOpenJob,
} from '../types'

const workerLogger = logger.child({ component: 'jobs', subcomponent: 'analytics-worker' })

type JobContext = {
  id?: string
  attempts?: number
}

export async function processAnalyticsJob(
  data: AnalyticsJobData,
  context: JobContext = {}
): Promise<void> {
  const { db } = createDb()
  const timer = workerLogger.time(`process-analytics-job-${data.type}`, {
    jobId: context.id,
    jobType: data.type,
  })

  try {
    switch (data.type) {
      case 'track-click': {
        await processClickTracking(data, db)
        break
      }

      case 'track-open': {
        await processOpenTracking(data, db)
        break
      }

      case 'aggregate-campaign-stats': {
        await processCampaignAggregation(data, db)
        break
      }
    }
  } catch (error) {
    workerLogger.error('Analytics job failed', error as Error, {
      jobId: context.id,
      jobType: data.type,
    })
    throw error
  } finally {
    timer()
  }
}

async function processClickTracking(data: TrackClickJob, db: any): Promise<void> {
  const { subscriberId, linkId, campaignId, userAgent, ipAddress } = data

  await db.insert(clickEvents).values({
    id: generateId(),
    subscriberId,
    linkId,
    clickedAt: new Date(),
    userAgent,
    ipAddress,
  })

  if (campaignId) await notifyCampaignEngagement(campaignId, 'click')

  workerLogger.debug('Click tracked', { subscriberId, linkId, campaignId })
}

async function processOpenTracking(data: TrackOpenJob, db: any): Promise<void> {
  // Open tracking typically uses a tracking pixel
  // This is a placeholder for open event storage
  // You may want to create an 'open_events' table similar to click_events
  if (data.campaignId) await notifyCampaignEngagement(data.campaignId, 'open')

  workerLogger.debug('Open tracked', {
    subscriberId: data.subscriberId,
    campaignId: data.campaignId,
  })
}

async function processCampaignAggregation(data: AggregateCampaignStatsJob, db: any): Promise<void> {
  const { campaignId } = data

  // This would typically aggregate stats and store them in a summary table
  // For now, we'll just log the aggregation
  const clickCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(clickEvents)
    .where(eq(clickEvents.linkId, campaignId))

  const count = clickCount[0]?.count || 0
  workerLogger.info('Campaign stats aggregated', { campaignId, clickCount: count })
}
