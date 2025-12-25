import { Worker, Job } from 'bullmq'

import { getRedisConnection, QUEUE_NAMES } from '../queue-config'
import type {
  ScheduledJobData,
  PublishScheduledDocumentJob,
  SendScheduledNewsletterJob,
} from '../types'
import { createDb } from '@api/db'
import { env } from '@api/env-runtime'
import { documents } from '@api/db/schema'
import { eq } from 'drizzle-orm'
import { enqueueNewsletter } from '../producers'

async function processScheduledJob(job: Job<ScheduledJobData>): Promise<void> {
  const { db, conn } = createDb(env.DATABASE_URL)

  try {
    switch (job.data.type) {
      case 'publish-scheduled-document': {
        await processDocumentPublish(job.data, db)
        break
      }

      case 'send-scheduled-newsletter': {
        await processScheduledNewsletter(job.data, db)
        break
      }
    }
  } finally {
    await conn.end()
  }
}

async function processDocumentPublish(data: PublishScheduledDocumentJob, db: any): Promise<void> {
  const { documentId } = data

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
    console.log(`Document ${documentId} published successfully`)
  } else {
    console.error(`Document ${documentId} not found for publishing`)
  }
}

async function processScheduledNewsletter(
  data: SendScheduledNewsletterJob,
  db: any
): Promise<void> {
  const { campaignId, documentId, writerId } = data

  // Enqueue the newsletter for immediate sending
  await enqueueNewsletter({
    campaignId,
    documentId,
    writerId,
  })

  console.log(`Scheduled newsletter ${campaignId} triggered for sending`)
}

export function createScheduledWorker() {
  const worker = new Worker<ScheduledJobData>(QUEUE_NAMES.SCHEDULED, processScheduledJob, {
    connection: getRedisConnection(),
    concurrency: 2,
  })

  worker.on('completed', (job) => {
    console.log(`Scheduled job ${job.id} completed: ${job.data.type}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Scheduled job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('Scheduled worker error:', err)
  })

  return worker
}
