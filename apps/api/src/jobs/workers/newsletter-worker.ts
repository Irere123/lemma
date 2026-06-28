import { renderToEmail } from '@lemma/content'
import { render } from '@react-email/render'
import { and, eq, inArray } from 'drizzle-orm'

import { createDb } from '@api/db'
import { getCampaignById, updateCampaign } from '@api/db/queries/campaigns'
import { getDocumentById } from '@api/db/queries/documents'
import { getWriterNewsletterSettings } from '@api/db/queries/newsletter-settings'
import { getConfirmedSubscribers } from '@api/db/queries/subscribers'
import { newsletterDeliveries, subscribers } from '@api/db/schema'
import { env } from '@api/env-runtime'
import { sendBatchEmails } from '@api/lib/messaging/email/mailer'
import { logger } from '@api/lib/observability'
import { generateId } from '@api/lib/utils'
import { enqueueNewsletter, scheduleNewsletter } from '../producers'
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

type JobContext = {
  id?: string
  attempts?: number
}

export async function processNewsletterJob(
  data: NewsletterJobData,
  context: JobContext = {}
): Promise<void> {
  const { db } = createDb()
  const timer = workerLogger.time(`process-newsletter-job-${data.type}`, {
    jobId: context.id,
    jobType: data.type,
  })

  try {
    switch (data.type) {
      case 'process-newsletter-batch': {
        await processBatch(data, db)
        break
      }

      case 'schedule-newsletter': {
        await processScheduledNewsletter(data, db)
        break
      }

      case 'send-ab-test': {
        await processABTest(data, db)
        break
      }
    }
  } catch (error) {
    workerLogger.error('Newsletter job failed', error as Error, {
      jobId: context.id,
      jobType: data.type,
      attempts: context.attempts,
    })
    throw error
  } finally {
    timer()
  }
}

async function processBatch(data: ProcessNewsletterBatchJob, db: any): Promise<void> {
  const { campaignId, documentId, writerId, subscriberBatch, batchIndex, totalBatches } = data

  workerLogger.info('Processing newsletter batch', {
    campaignId,
    batchIndex: batchIndex + 1,
    totalBatches,
    subscriberCount: subscriberBatch.length,
  })

  const document = await getDocumentById(db, documentId)
  if (!document) {
    throw new Error(`Document ${documentId} not found`)
  }

  const writerSettings = await getWriterNewsletterSettings(db, writerId)
  if (!writerSettings) {
    throw new Error(`Writer settings for ${writerId} not found`)
  }

  const batchSubscribers = await db
    .select()
    .from(subscribers)
    .where(inArray(subscribers.id, subscriberBatch))

  if (batchSubscribers.length === 0) {
    workerLogger.warn('No subscribers found in batch', { batchIndex, campaignId })
    return
  }

  // Idempotency: atomically claim each (campaignId, subscriberId) pair. Only the
  // newly-inserted rows proceed, so a retried batch never re-sends to a
  // subscriber who already received this campaign.
  const claimed = await db
    .insert(newsletterDeliveries)
    .values(
      batchSubscribers.map((s: any) => ({
        id: generateId('nd'),
        campaignId,
        subscriberId: s.id,
      }))
    )
    .onConflictDoNothing()
    .returning({ subscriberId: newsletterDeliveries.subscriberId })

  const claimedIds = new Set(claimed.map((c: { subscriberId: string }) => c.subscriberId))
  const recipients = batchSubscribers.filter((s: any) => claimedIds.has(s.id))

  if (recipients.length === 0) {
    workerLogger.info('Newsletter batch already delivered, skipping', { batchIndex, campaignId })
    return
  }

  const NewsletterTemplate = await getNewsletterTemplate()

  // Render the body from the canonical Tiptap JSON; markdown is the fallback
  // for legacy documents that predate the JSON content column.
  const bodyHtml = document.content ? renderToEmail(document.content) : null

  const emails = await Promise.all(
    recipients.map(async (subscriber: any) => {
      const html = await render(
        NewsletterTemplate({
          document: {
            id: document.id,
            title: document.title,
            subtitle: document.subtitle,
            markdown: document.markdown,
            bodyHtml,
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

  // Send batch. If it fails, release the claims so the retry re-attempts these
  // recipients instead of skipping them as "already delivered".
  let result: Awaited<ReturnType<typeof sendBatchEmails>>
  try {
    result = await sendBatchEmails({
      emails: emails.map((e) => ({
        ...e,
        emailType: 'marketing' as const,
      })),
    })
  } catch (error) {
    await db.delete(newsletterDeliveries).where(
      and(
        eq(newsletterDeliveries.campaignId, campaignId),
        inArray(
          newsletterDeliveries.subscriberId,
          recipients.map((s: any) => s.id)
        )
      )
    )
    throw error
  }

  workerLogger.info('Newsletter batch completed', {
    campaignId,
    batchIndex: batchIndex + 1,
    totalBatches,
    recipientCount: recipients.length,
    result: result.message,
  })
}

async function processScheduledNewsletter(data: ScheduleNewsletterJob, db: any): Promise<void> {
  const { campaignId, documentId, writerId, scheduledAt } = data
  const campaign = await getCampaignById(db, campaignId)

  if (!campaign || campaign.status !== 'SCHEDULED') {
    workerLogger.info('Scheduled newsletter skipped because campaign is no longer scheduled', {
      campaignId,
      status: campaign?.status,
    })
    return
  }

  const scheduledDate = new Date(scheduledAt)
  const now = new Date()

  if (scheduledDate <= now) {
    await updateCampaign(db, {
      id: campaignId,
      status: 'SENDING',
    })
    await enqueueNewsletter({
      campaignId,
      documentId,
      writerId,
    })
    workerLogger.info('Scheduled newsletter triggered for immediate send', { campaignId })
  } else {
    await scheduleNewsletter(data)
    workerLogger.info('Newsletter rescheduled', {
      campaignId,
      scheduledAt,
      delay: scheduledDate.getTime() - now.getTime(),
    })
  }
}

async function processABTest(data: SendABTestJob, db: any): Promise<void> {
  const { campaignId, variants, writerId, testDurationHours } = data

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
