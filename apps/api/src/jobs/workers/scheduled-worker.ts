import { Job, Worker } from 'bullmq'
import { eq } from 'drizzle-orm'

import { createDb } from '@api/db'
import { documents } from '@api/db/schema'
import { env } from '@api/env-runtime'
import { logger } from '@api/lib/observability'
import { withJobSpan } from '@api/lib/observability/tracing'
import { enqueueNewsletter } from '../producers'
import { getRedisConnection, QUEUE_NAMES } from '../queue-config'
import type {
  PublishScheduledDocumentJob,
  ScheduledJobData,
  SendScheduledNewsletterJob,
} from '../types'

const workerLogger = logger.child({ component: 'jobs', subcomponent: 'scheduled-worker' })

async function processScheduledJob(job: Job<ScheduledJobData>): Promise<void> {
  return withJobSpan(`scheduled-${job.data.type}`, job.id || 'unknown', async (span) => {
    const { db, conn } = createDb(env.DATABASE_URL)
    const timer = workerLogger.time(`process-scheduled-job-${job.data.type}`, {
      jobId: job.id,
      jobType: job.data.type,
    })

    try {
      span.setAttribute('job.id', job.id!)
      span.setAttribute('job.type', job.data.type)

      switch (job.data.type) {
        case 'publish-scheduled-document': {
          await processDocumentPublish(job.data, db, span)
          break
        }

        case 'send-scheduled-newsletter': {
          await processScheduledNewsletter(job.data, db, span)
          break
        }
      }
    } catch (error) {
      workerLogger.error('Scheduled job failed', error as Error, {
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

async function processDocumentPublish(
  data: PublishScheduledDocumentJob,
  db: any,
  span?: any
): Promise<void> {
  const { documentId } = data

  if (span) {
    span.setAttribute('document.id', documentId)
  }

  // Update document status to PUBLISHED
  const [updatedDocument] = await db
    .update(documents)
    .set({
      status: 'PUBLISHED',
      publishedDate: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId))
    .returning()

  if (updatedDocument) {
    workerLogger.info('Document published successfully', { documentId })
  } else {
    const error = new Error(`Document ${documentId} not found for publishing`)
    workerLogger.error('Document not found for publishing', error, { documentId })
    throw error
  }
}

async function processScheduledNewsletter(
  data: SendScheduledNewsletterJob,
  db: any,
  span?: any
): Promise<void> {
  const { campaignId, documentId, writerId } = data

  if (span) {
    span.setAttribute('newsletter.campaignId', campaignId)
    span.setAttribute('newsletter.documentId', documentId)
    span.setAttribute('newsletter.writerId', writerId)
  }

  // Enqueue the newsletter for immediate sending
  await enqueueNewsletter({
    campaignId,
    documentId,
    writerId,
  })

  workerLogger.info('Scheduled newsletter triggered', { campaignId, documentId, writerId })
}

export function createScheduledWorker() {
  const worker = new Worker<ScheduledJobData>(QUEUE_NAMES.SCHEDULED, processScheduledJob, {
    connection: getRedisConnection(),
    concurrency: 2,
  })

  worker.on('completed', (job) => {
    workerLogger.info('Scheduled job completed', {
      jobId: job.id,
      jobType: job.data.type,
      duration: job.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : undefined,
    })
  })

  worker.on('failed', (job, err) => {
    workerLogger.error('Scheduled job failed', err, {
      jobId: job?.id,
      jobType: job?.data.type,
    })
  })

  worker.on('error', (err) => {
    workerLogger.error('Scheduled worker error', err)
  })

  return worker
}
