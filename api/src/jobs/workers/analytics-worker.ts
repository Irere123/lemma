import { Job, Worker } from 'bullmq'
import { eq, sql } from 'drizzle-orm'

import { createDb } from '@api/db'
import { clickEvents } from '@api/db/schema'
import { env } from '@api/env-runtime'
import { generateId } from '@api/lib/utils'
import { getRedisConnection, QUEUE_NAMES } from '../queue-config'
import type {
  AggregateCampaignStatsJob,
  AnalyticsJobData,
  TrackClickJob,
  TrackOpenJob,
} from '../types'

async function processAnalyticsJob(job: Job<AnalyticsJobData>): Promise<void> {
  const { db, conn } = createDb(env.DATABASE_URL)

  try {
    switch (job.data.type) {
      case 'track-click': {
        await processClickTracking(job.data, db)
        break
      }

      case 'track-open': {
        await processOpenTracking(job.data, db)
        break
      }

      case 'aggregate-campaign-stats': {
        await processCampaignAggregation(job.data, db)
        break
      }
    }
  } finally {
    await conn.end()
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

  console.log(`Click tracked for subscriber ${subscriberId} on link ${linkId}`)
}

async function processOpenTracking(data: TrackOpenJob, db: any): Promise<void> {
  // Open tracking typically uses a tracking pixel
  // This is a placeholder for open event storage
  // You may want to create an 'open_events' table similar to click_events
  console.log(`Open tracked for subscriber ${data.subscriberId} on campaign ${data.campaignId}`)
}

async function processCampaignAggregation(data: AggregateCampaignStatsJob, db: any): Promise<void> {
  const { campaignId } = data

  // This would typically aggregate stats and store them in a summary table
  // For now, we'll just log the aggregation
  const clickCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(clickEvents)
    .where(eq(clickEvents.linkId, campaignId))

  console.log(`Campaign ${campaignId} aggregation: ${clickCount[0]?.count || 0} clicks`)
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
    console.log(`Analytics job ${job.id} completed: ${job.data.type}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Analytics job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('Analytics worker error:', err)
  })

  return worker
}
