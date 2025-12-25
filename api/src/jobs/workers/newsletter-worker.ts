import { Worker, Job } from 'bullmq'
import { render } from '@react-email/render'

import { getRedisConnection, QUEUE_NAMES } from '../queue-config'
import type {
  NewsletterJobData,
  ProcessNewsletterBatchJob,
  ScheduleNewsletterJob,
  SendABTestJob,
} from '../types'
import { sendBatchEmails } from '@api/lib/messaging/email/mailer'
import { createDb } from '@api/db'
import { env } from '@api/env-runtime'
import { getConfirmedSubscribers } from '@api/db/queries/subscribers'
import { getWriterNewsletterSettings } from '@api/db/queries/newsletter-settings'
import { getDocumentById } from '@api/db/queries/documents'
import { enqueueNewsletter, enqueueNewsletterBatch } from '../producers'
import { inArray } from 'drizzle-orm'
import { subscribers } from '@api/db/schema'

const getNewsletterTemplate = async () => {
  const { DynamicDocumentNewsletter } = await import('@lemma/email/emails/newsletter')
  return DynamicDocumentNewsletter
}

async function processNewsletterJob(job: Job<NewsletterJobData>): Promise<void> {
  const { db, conn } = createDb(env.DATABASE_URL)

  try {
    switch (job.data.type) {
      case 'process-newsletter-batch': {
        await processBatch(job.data, db)
        break
      }

      case 'schedule-newsletter': {
        await processScheduledNewsletter(job.data, db)
        break
      }

      case 'send-ab-test': {
        await processABTest(job.data, db)
        break
      }
    }
  } finally {
    await conn.end()
  }
}

async function processBatch(data: ProcessNewsletterBatchJob, db: any): Promise<void> {
  const { campaignId, documentId, writerId, subscriberBatch, batchIndex, totalBatches } = data

  console.log(`Processing batch ${batchIndex + 1}/${totalBatches} for campaign ${campaignId}`)

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
    console.log(`No subscribers found in batch ${batchIndex}`)
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

  console.log(`Batch ${batchIndex + 1}/${totalBatches} completed: ${result.message}`)
}

async function processScheduledNewsletter(data: ScheduleNewsletterJob, db: any): Promise<void> {
  const { campaignId, documentId, writerId, scheduledAt } = data

  const scheduledDate = new Date(scheduledAt)
  const now = new Date()

  // If scheduled time has arrived, trigger the send
  if (scheduledDate <= now) {
    await enqueueNewsletter({
      campaignId,
      documentId,
      writerId,
    })
    console.log(`Scheduled newsletter ${campaignId} triggered for immediate send`)
  } else {
    // Re-schedule with remaining delay
    const delay = scheduledDate.getTime() - now.getTime()
    console.log(`Newsletter ${campaignId} scheduled for ${scheduledAt}, delay: ${delay}ms`)
  }
}

async function processABTest(data: SendABTestJob, db: any): Promise<void> {
  const { campaignId, variants, writerId, testDurationHours } = data

  // Get all confirmed subscribers
  const allSubscribers = await getConfirmedSubscribers(db, writerId)

  if (allSubscribers.length === 0) {
    console.log('No subscribers for A/B test')
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
      console.log(
        `A/B test variant ${variant.variantId}: sending to ${subscriberIds.length} subscribers`
      )
    }
  }

  console.log(`A/B test ${campaignId} started with ${variants.length} variants`)
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
    console.log(`Newsletter job ${job.id} completed: ${job.data.type}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Newsletter job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('Newsletter worker error:', err)
  })

  return worker
}
