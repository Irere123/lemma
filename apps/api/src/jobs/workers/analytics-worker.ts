import { Job, Worker } from 'bullmq'
import { eq, sql } from 'drizzle-orm'

import { createDb } from '@api/db'
import { clickEvents } from '@api/db/schema'
import { env } from '@api/env-runtime'
import { logger } from '@api/lib/observability'
import { withJobSpan } from '@api/lib/observability/tracing'
import { generateId } from '@api/lib/utils'
import { getRedisConnection, QUEUE_NAMES } from '../queue-config'
import type {
  AggregateCampaignStatsJob,
  AnalyticsJobData,
  TrackClickJob,
  TrackOpenJob,
} from '../types'

const workerLogger = logger.child({ component: 'jobs', subcomponent: 'analytics-worker' })

async function processAnalyticsJob(job: Job<AnalyticsJobData>): Promise<void> {
  return withJobSpan(`analytics-${job.data.type}`, job.id || 'unknown', async (span) => {
    const { db, conn } = createDb(env.DATABASE_URL)
    const timer = workerLogger.time(`process-analytics-job-${job.data.type}`, {
      jobId: job.id,
      jobType: job.data.type,
    })

    try {
      span.setAttribute('job.id', job.id!)
      span.setAttribute('job.type', job.data.type)

      switch (job.data.type) {
        case 'track-click': {
          await processClickTracking(job.data, db, span)
          break
        }

        case 'track-open': {
          await processOpenTracking(job.data, db, span)
          break
        }

        case 'aggregate-campaign-stats': {
          await processCampaignAggregation(job.data, db, span)
          break
        }
      }
    } catch (error) {
      workerLogger.error('Analytics job failed', error as Error, {
        jobId: job.id,
        jobType: job.data.type,
      })
      throw error
    } finally {
      await conn.end()
      timer()
    }
  })
}

async function processClickTracking(data: TrackClickJob, db: any, span?: any): Promise<void> {
  const { subscriberId, linkId, campaignId, userAgent, ipAddress } = data

  if (span) {
    span.setAttribute('analytics.subscriberId', subscriberId)
    span.setAttribute('analytics.campaignId', campaignId)
    span.setAttribute('analytics.linkId', linkId)
  }

  await db.insert(clickEvents).values({
    id: generateId(),
    subscriberId,
    linkId,
    clickedAt: new Date(),
    userAgent,
    ipAddress,
  })

  workerLogger.debug('Click tracked', { subscriberId, linkId, campaignId })
}

async function processOpenTracking(data: TrackOpenJob, db: any, span?: any): Promise<void> {
  // Open tracking typically uses a tracking pixel
  // This is a placeholder for open event storage
  // You may want to create an 'open_events' table similar to click_events
  if (span) {
    span.setAttribute('analytics.subscriberId', data.subscriberId)
    span.setAttribute('analytics.campaignId', data.campaignId)
  }
  workerLogger.debug('Open tracked', {
    subscriberId: data.subscriberId,
    campaignId: data.campaignId,
  })
}

async function processCampaignAggregation(
  data: AggregateCampaignStatsJob,
  db: any,
  span?: any
): Promise<void> {
  const { campaignId } = data

  if (span) {
    span.setAttribute('analytics.campaignId', campaignId)
  }

  // This would typically aggregate stats and store them in a summary table
  // For now, we'll just log the aggregation
  const clickCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(clickEvents)
    .where(eq(clickEvents.linkId, campaignId))

  const count = clickCount[0]?.count || 0
  if (span) {
    span.setAttribute('analytics.clickCount', count)
  }
  workerLogger.info('Campaign stats aggregated', { campaignId, clickCount: count })
}

export function createAnalyticsWorker() {
  const worker = new Worker<AnalyticsJobData>(QUEUE_NAMES.ANALYTICS, processAnalyticsJob, {
    connection: getRedisConnection(),
    concurrency: 10,
    limiter: {
      max: 1000,
      duration: 1000, // High throughput for analytics
    },
  })

  worker.on('completed', (job) => {
    workerLogger.info('Analytics job completed', {
      jobId: job.id,
      jobType: job.data.type,
      duration: job.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : undefined,
    })
  })

  worker.on('failed', (job, err) => {
    workerLogger.error('Analytics job failed', err, {
      jobId: job?.id,
      jobType: job?.data.type,
    })
  })

  worker.on('error', (err) => {
    workerLogger.error('Analytics worker error', err)
  })

  return worker
}
