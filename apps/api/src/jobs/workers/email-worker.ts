import { render } from '@react-email/render'
import { Job, Worker } from 'bullmq'

import { createDb } from '@api/db'
import { getDocumentById } from '@api/db/queries/documents'
import { getWriterNewsletterSettings } from '@api/db/queries/newsletter-settings'
import { getConfirmedSubscribers } from '@api/db/queries/subscribers'
import { env } from '@api/env-runtime'
import { sendBatchEmails, sendEmail } from '@api/lib/messaging/email/mailer'
import { enqueueNewsletterBatch } from '../producers'
import { getRedisConnection, QUEUE_NAMES } from '../queue-config'
import type {
  EmailJobData,
  SendConfirmationEmailJob,
  SendNewsletterJob,
  SendWelcomeEmailJob,
} from '../types'

// Lazy import email templates to avoid bundling issues
const getNewsletterTemplate = async () => {
  const { DynamicDocumentNewsletter } = await import('@lemma/email/emails/newsletter')
  return DynamicDocumentNewsletter
}

const getSubscriptionTemplate = async () => {
  const { NewsletterSubscriptionEmail } = await import('@lemma/email/emails/subscription')
  return NewsletterSubscriptionEmail
}

const BATCH_SIZE = 50

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { db, conn } = createDb(env.DATABASE_URL)

  try {
    switch (job.data.type) {
      case 'send-single-email': {
        const { to, subject, html, text, from, replyTo } = job.data
        await sendEmail({
          to,
          subject,
          html,
          text,
          from,
          replyTo,
          emailType: 'transactional',
        })
        break
      }

      case 'send-batch-email': {
        const { emails } = job.data
        await sendBatchEmails({
          emails: emails.map((e) => ({
            ...e,
            emailType: 'marketing' as const,
          })),
        })
        break
      }

      case 'send-welcome-email': {
        await processWelcomeEmail(job.data, db)
        break
      }

      case 'send-confirmation-email': {
        await processConfirmationEmail(job.data, db)
        break
      }

      case 'send-newsletter': {
        await processNewsletterSend(job.data, db)
        break
      }
    }
  } finally {
    await conn.end()
  }
}

async function processWelcomeEmail(data: SendWelcomeEmailJob, db: any): Promise<void> {
  const { email, token, writerSettings } = data

  const SubscriptionTemplate = await getSubscriptionTemplate()
  const html = await render(
    SubscriptionTemplate({
      writerSettings: {
        id: writerSettings.id,
        fromName: writerSettings.fromName,
        newsletterName: writerSettings.newsletterName,
        logoUrl: writerSettings.logoUrl,
        brandColor: writerSettings.brandColor || '#000000',
        baseUrl: env.FRONTEND_URL,
        confirmationUrl: writerSettings.confirmationUrl || undefined,
      },
      token,
    })
  )

  await sendEmail({
    to: email,
    subject: `Welcome to ${writerSettings.newsletterName}`,
    html,
    from: `${writerSettings.fromName} <newsletter@${env.RESEND_DOMAIN}>`,
    emailType: 'transactional',
  })
}

async function processConfirmationEmail(data: SendConfirmationEmailJob, db: any): Promise<void> {
  const { email, token, writerSettings } = data

  const SubscriptionTemplate = await getSubscriptionTemplate()
  const html = await render(
    SubscriptionTemplate({
      writerSettings: {
        id: writerSettings.id,
        fromName: writerSettings.fromName,
        newsletterName: writerSettings.newsletterName,
        logoUrl: writerSettings.logoUrl,
        brandColor: writerSettings.brandColor || '#000000',
        baseUrl: env.FRONTEND_URL,
        confirmationUrl: writerSettings.confirmationUrl || undefined,
      },
      token,
    })
  )

  await sendEmail({
    to: email,
    subject: `Confirm your subscription to ${writerSettings.newsletterName}`,
    html,
    from: `${writerSettings.fromName} <newsletter@${env.RESEND_DOMAIN}>`,
    emailType: 'transactional',
  })
}

async function processNewsletterSend(data: SendNewsletterJob, db: any): Promise<void> {
  const { documentId, writerId, campaignId, subscriberIds } = data

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

  // Get subscribers
  let subscribers: { id: string; email: string; token: string }[]
  if (subscriberIds && subscriberIds.length > 0) {
    // Specific subscribers - would need a new query for this
    const allSubscribers = await getConfirmedSubscribers(db, writerId)
    subscribers = allSubscribers
      .filter((s) => subscriberIds.includes(s.id))
      .map((s) => ({ id: s.id, email: s.email, token: s.token }))
  } else {
    const allSubscribers = await getConfirmedSubscribers(db, writerId)
    subscribers = allSubscribers.map((s) => ({ id: s.id, email: s.email, token: s.token }))
  }

  if (subscribers.length === 0) {
    console.log('No subscribers to send newsletter to')
    return
  }

  // Split into batches and enqueue batch jobs
  const batches = []
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    batches.push(subscribers.slice(i, i + BATCH_SIZE))
  }

  // Enqueue batch processing jobs
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    if (!batch) continue

    await enqueueNewsletterBatch({
      campaignId,
      documentId,
      writerId,
      subscriberBatch: batch.map((s) => s.id),
      batchIndex: i,
      totalBatches: batches.length,
    })
  }

  console.log(`Enqueued ${batches.length} batches for newsletter ${campaignId}`)
}

export function createEmailWorker() {
  const worker = new Worker<EmailJobData>(QUEUE_NAMES.EMAIL, processEmailJob, {
    connection: getRedisConnection(),
    concurrency: 5,
    limiter: {
      max: 100,
      duration: 1000, // 100 jobs per second max
    },
  })

  worker.on('completed', (job) => {
    console.log(`Email job ${job.id} completed: ${job.data.type}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Email job ${job?.id} failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('Email worker error:', err)
  })

  return worker
}
