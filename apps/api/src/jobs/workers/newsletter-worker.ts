import { render } from '@react-email/render'
import { Job, Worker } from 'bullmq'
import { inArray } from 'drizzle-orm'

import { createDb } from '@api/db'
import { getDocumentById } from '@api/db/queries/documents'
import { getWriterNewsletterSettings } from '@api/db/queries/newsletter-settings'
import { getConfirmedSubscribers } from '@api/db/queries/subscribers'
import { subscribers } from '@api/db/schema'
import { env } from '@api/env-runtime'
import { logger } from '@api/lib/observability'
import { withJobSpan } from '@api/lib/observability/tracing'
import { sendBatchEmails } from '@api/lib/messaging/email/mailer'
import { enqueueNewsletter } from '../producers'
import { getRedisConnection, QUEUE_NAMES } from '../queue-config'
import type {
  NewsletterJobData,
  ProcessNewsletterBatchJob,
  ScheduleNewsletterJob,
  SendABTestJob,
} from '../types'

const workerLogger = logger.child({ component: 'jobs', subcomponent: 'newsletter-worker' })

const getNewsletterTemplate = async () => {
  const { DynamicDocumentNewsletter } = await import('@lemma/email/emails/newsletter')
  return DynamicDocumentNewsletter
}

async function processNewsletterJob(job: Job<NewsletterJobData>): Promise<void> {
  return withJobSpan(`newsletter-${job.data.type}`, job.id || 'unknown', async (span) => {
    const { db, conn } = createDb(env.DATABASE_URL)
    const timer = workerLogger.time(`process-newsletter-job-${job.data.type}`, {
      jobId: job.id,
      jobType: job.data.type,
    })

    try {
      span.setAttribute('job.id', job.id!)
      span.setAttribute('job.type', job.data.type)
      span.setAttribute('job.attempts', job.attemptsMade)

      switch (job.data.type) {
        case 'process-newsletter-batch': {
          await processBatch(job.data, db, span)
          break
        }

        case 'schedule-newsletter': {
          await processScheduledNewsletter(job.data, db, span)
          break
        }

        case 'send-ab-test': {
          await processABTest(job.data, db, span)
          break
        }
      }
    } catch (error) {
      workerLogger.error('Newsletter job failed', error as Error, {
        jobId: job.id,
        jobType: job.data.type,
        attempts: job.attemptsMade,
      })
      throw error
    } finally {
      await conn.end()
      timer()
    }
  })
}

async function processBatch(data: ProcessNewsletterBatchJob, db: any, span?: any): Promise<void> {
  const { campaignId, documentId, writerId, subscriberBatch, batchIndex, totalBatches } = data

  if (span) {
    span.setAttribute('newsletter.campaignId', campaignId)
    span.setAttribute('newsletter.batchIndex', batchIndex)
    span.setAttribute('newsletter.totalBatches', totalBatches)
    span.setAttribute('newsletter.subscriberCount', subscriberBatch.length)
  }

  workerLogger.info('Processing newsletter batch', {
    campaignId,
    batchIndex: batchIndex + 1,
    totalBatches,
    subscriberCount: subscriberBatch.length,
  })

  // Get document
  const document = await getDocumentById(db, documentId)
  if (!document) {
    throw new Error(`Document ${documentId} not found`)
  }

  // Get writer settings
  const writerSettings = await getWriterNewsletterSettings(db, writerId)
  if (!writerSettings) {
    throw new Error(`Writer settings for ${writerId} not found`)
  }

  // Get subscribers in this batch
  const batchSubscribers = await db
    .select()
    .from(subscribers)
    .where(inArray(subscribers.id, subscriberBatch))

  if (batchSubscribers.length === 0) {
    workerLogger.warn('No subscribers found in batch', { batchIndex, campaignId })
    return
  }

  // Render newsletter template
  const NewsletterTemplate = await getNewsletterTemplate()

  // Prepare batch emails
  const emails = await Promise.all(
    batchSubscribers.map(async (subscriber: any) => {
      const html = await render(
        NewsletterTemplate({
          document: {
            id: document.id,
            title: document.title,
            subtitle: document.subtitle,
            markdown: document.markdown,
            bannerImage: document.bannerImage,
            publishedDate: document.publishedDate,
            scheduledDate: document.scheduledDate,
          },
          writerSettings: {
            id: writerSettings.id,
            fromName: writerSettings.fromName,
            newsletterName: writerSettings.newsletterName,
            logoUrl: writerSettings.logoUrl,
            brandColor: writerSettings.brandColor || '#000000',
            baseUrl: env.FRONTEND_URL,
            confirmationUrl: writerSettings.confirmationUrl || undefined,
          },
          recipientEmail: subscriber.email,
          unsubscribeToken: subscriber.token,
        })
      )

      return {
        to: subscriber.email,
        subject: document.title || 'New Newsletter',
        html,
        from: `${writerSettings.fromName} <newsletter@${env.RESEND_DOMAIN}>`,
      }
    })
  )

  // Send batch
  const result = await sendBatchEmails({
    emails: emails.map((e) => ({
      ...e,
      emailType: 'marketing' as const,
    })),
  })

  workerLogger.info('Newsletter batch completed', {
    campaignId,
    batchIndex: batchIndex + 1,
    totalBatches,
    result: result.message,
  })
}

async function processScheduledNewsletter(
  data: ScheduleNewsletterJob,
  db: any,
  span?: any
): Promise<void> {
  const { campaignId, documentId, writerId, scheduledAt } = data

  if (span) {
    span.setAttribute('newsletter.campaignId', campaignId)
    span.setAttribute('newsletter.scheduledAt', scheduledAt)
  }

  const scheduledDate = new Date(scheduledAt)
  const now = new Date()

  // If scheduled time has arrived, trigger the send
  if (scheduledDate <= now) {
    await enqueueNewsletter({
      campaignId,
      documentId,
      writerId,
    })
    workerLogger.info('Scheduled newsletter triggered for immediate send', { campaignId })
  } else {
    // Re-schedule with remaining delay
    const delay = scheduledDate.getTime() - now.getTime()
    workerLogger.info('Newsletter rescheduled', { campaignId, scheduledAt, delay })
  }
}

async function processABTest(data: SendABTestJob, db: any, span?: any): Promise<void> {
  const { campaignId, variants, writerId, testDurationHours } = data

  if (span) {
    span.setAttribute('abtest.campaignId', campaignId)
    span.setAttribute('abtest.variantCount', variants.length)
    span.setAttribute('abtest.durationHours', testDurationHours)
  }

  // Get all confirmed subscribers
  const allSubscribers = await getConfirmedSubscribers(db, writerId)

  if (allSubscribers.length === 0) {
    workerLogger.warn('No subscribers for A/B test', { campaignId, writerId })
    return
  }

  // Shuffle subscribers for random distribution
  const shuffled = [...allSubscribers].sort(() => Math.random() - 0.5)

  // Calculate subscriber counts for each variant
  let assignedCount = 0
  const variantAssignments: Map<string, string[]> = new Map()

  for (const variant of variants) {
    const count = Math.floor((variant.percentage / 100) * shuffled.length)
    const subscriberIds = shuffled.slice(assignedCount, assignedCount + count).map((s) => s.id)
    variantAssignments.set(variant.variantId, subscriberIds)
    assignedCount += count
  }

  // Enqueue newsletter sends for each variant
  for (const variant of variants) {
    const subscriberIds = variantAssignments.get(variant.variantId) || []
    if (subscriberIds.length > 0) {
      await enqueueNewsletter({
        campaignId: `${campaignId}_${variant.variantId}`,
        documentId: variant.documentId,
        writerId,
        subscriberIds,
      })
      workerLogger.info('A/B test variant enqueued', {
        campaignId,
        variantId: variant.variantId,
        subscriberCount: subscriberIds.length,
      })
    }
  }

  workerLogger.info('A/B test started', { campaignId, variantCount: variants.length })
}

export function createNewsletterWorker() {
  const worker = new Worker<NewsletterJobData>(QUEUE_NAMES.NEWSLETTER, processNewsletterJob, {
    connection: getRedisConnection(),
    concurrency: 3,
    limiter: {
      max: 10,
      duration: 1000, // 10 jobs per second max
    },
  })

  worker.on('completed', (job) => {
    workerLogger.info('Newsletter job completed', {
      jobId: job.id,
      jobType: job.data.type,
      duration: job.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : undefined,
    })
  })

  worker.on('failed', (job, err) => {
    workerLogger.error('Newsletter job failed', err, {
      jobId: job?.id,
      jobType: job?.data.type,
      attempts: job?.attemptsMade,
    })
  })

  worker.on('error', (err) => {
    workerLogger.error('Newsletter worker error', err)
  })

  return worker
}
