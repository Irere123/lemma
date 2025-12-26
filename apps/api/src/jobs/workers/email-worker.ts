import { render } from '@react-email/render'
import { Job, Worker } from 'bullmq'

import { createDb } from '@api/db'
import { getDocumentById } from '@api/db/queries/documents'
import { getWriterNewsletterSettings } from '@api/db/queries/newsletter-settings'
import { getConfirmedSubscribers } from '@api/db/queries/subscribers'
import { env } from '@api/env-runtime'
import { sendBatchEmails, sendEmail } from '@api/lib/messaging/email/mailer'
import { logger } from '@api/lib/observability'
import { withJobSpan } from '@api/lib/observability/tracing'
import { enqueueNewsletterBatch } from '../producers'
import { getRedisConnection, QUEUE_NAMES } from '../queue-config'
import type {
  EmailJobData,
  SendConfirmationEmailJob,
  SendNewsletterJob,
  SendWelcomeEmailJob,
} from '../types'

const workerLogger = logger.child({ component: 'jobs', subcomponent: 'email-worker' })

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
  return withJobSpan(`email-${job.data.type}`, job.id || 'unknown', async (span) => {
    const { db, conn } = createDb(env.DATABASE_URL)
    const processTimer = workerLogger.time(`process-email-job-${job.data.type}`, {
      jobId: job.id,
      jobType: job.data.type,
    })

    try {
      span.setAttribute('job.id', job.id!)
      span.setAttribute('job.type', job.data.type)
      span.setAttribute('job.attempts', job.attemptsMade)

      switch (job.data.type) {
        case 'send-single-email': {
          const { to, subject, html, text, from, replyTo } = job.data
          span.setAttribute('email.to', to)
          await sendEmail({
            to,
            subject,
            html,
            text,
            from,
            replyTo,
            emailType: 'transactional',
          })
          workerLogger.info('Single email sent', { jobId: job.id, to })
          break
        }

        case 'send-batch-email': {
          const { emails } = job.data
          span.setAttribute('email.count', emails.length)
          await sendBatchEmails({
            emails: emails.map((e) => ({
              ...e,
              emailType: 'marketing' as const,
            })),
          })
          workerLogger.info('Batch emails sent', { jobId: job.id, count: emails.length })
          break
        }

        case 'send-welcome-email': {
          await processWelcomeEmail(job.data, db, span)
          break
        }

        case 'send-confirmation-email': {
          await processConfirmationEmail(job.data, db, span)
          break
        }

        case 'send-newsletter': {
          await processNewsletterSend(job.data, db, span)
          break
        }
      }
    } catch (error) {
      workerLogger.error('Email job failed', error as Error, {
        jobId: job.id,
        jobType: job.data.type,
        attempts: job.attemptsMade,
      })
      throw error
    } finally {
      await conn.end()
      processTimer()
    }
  })
}

async function processWelcomeEmail(data: SendWelcomeEmailJob, db: any, span?: any): Promise<void> {
  const { email, token, writerSettings } = data

  if (span) {
    span.setAttribute('email.to', email)
    span.setAttribute('email.writerId', data.writerId)
  }

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

  workerLogger.info('Welcome email sent', { email, writerId: data.writerId })
}

async function processConfirmationEmail(
  data: SendConfirmationEmailJob,
  db: any,
  span?: any
): Promise<void> {
  const { email, token, writerSettings } = data

  if (span) {
    span.setAttribute('email.to', email)
    span.setAttribute('email.writerId', data.writerId)
  }

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

  workerLogger.info('Confirmation email sent', { email, writerId: data.writerId })
}

async function processNewsletterSend(data: SendNewsletterJob, db: any, span?: any): Promise<void> {
  const { documentId, writerId, campaignId, subscriberIds } = data

  if (span) {
    span.setAttribute('newsletter.campaignId', campaignId)
    span.setAttribute('newsletter.documentId', documentId)
    span.setAttribute('newsletter.writerId', writerId)
  }

  // Get document
  const document = await getDocumentById(db, documentId)
  if (!document) {
    const error = new Error(`Document ${documentId} not found`)
    workerLogger.error('Document not found for newsletter', error, { documentId, campaignId })
    throw error
  }

  // Get writer settings
  const writerSettings = await getWriterNewsletterSettings(db, writerId)
  if (!writerSettings) {
    const error = new Error(`Writer settings for ${writerId} not found`)
    workerLogger.error('Writer settings not found', error, { writerId, campaignId })
    throw error
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
    workerLogger.warn('No subscribers to send newsletter to', { campaignId, writerId })
    return
  }

  if (span) {
    span.setAttribute('newsletter.subscriberCount', subscribers.length)
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

  workerLogger.info('Newsletter batches enqueued', {
    campaignId,
    batchCount: batches.length,
    subscriberCount: subscribers.length,
  })
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
    workerLogger.info('Email job completed', {
      jobId: job.id,
      jobType: job.data.type,
      duration: job.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : undefined,
    })
  })

  worker.on('failed', (job, err) => {
    workerLogger.error('Email job failed', err, {
      jobId: job?.id,
      jobType: job?.data.type,
      attempts: job?.attemptsMade,
    })
  })

  worker.on('error', (err) => {
    workerLogger.error('Email worker error', err)
  })

  return worker
}
