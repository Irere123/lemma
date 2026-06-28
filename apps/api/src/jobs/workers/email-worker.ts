import { render } from '@react-email/render'

import { createDb } from '@api/db'
import { getDocumentById } from '@api/db/queries/documents'
import { getWriterNewsletterSettings } from '@api/db/queries/newsletter-settings'
import { getConfirmedSubscribers } from '@api/db/queries/subscribers'
import { env } from '@api/env-runtime'
import { sendBatchEmails, sendEmail } from '@api/lib/messaging/email/mailer'
import { logger } from '@api/lib/observability'
import { enqueueNewsletterBatch } from '../producers'
import type {
  EmailJobData,
  SendConfirmationEmailJob,
  SendNewsletterJob,
  SendWelcomeEmailJob,
} from '../types'

const workerLogger = logger.child({ component: 'jobs', subcomponent: 'email-worker' })

const getSubscriptionTemplate = async () => {
  const { NewsletterSubscriptionEmail } = await import('@lemma/email/emails/subscription')
  return NewsletterSubscriptionEmail
}

const BATCH_SIZE = 50

type JobContext = {
  id?: string
  attempts?: number
}

export async function processEmailJob(data: EmailJobData, context: JobContext = {}): Promise<void> {
  const { db } = createDb()
  const processTimer = workerLogger.time(`process-email-job-${data.type}`, {
    jobId: context.id,
    jobType: data.type,
  })

  try {
    switch (data.type) {
      case 'send-single-email': {
        const { to, subject, html, text, from, replyTo } = data
        await sendEmail({
          to,
          subject,
          html,
          text,
          from,
          replyTo,
          emailType: 'transactional',
        })
        workerLogger.info('Single email sent', { jobId: context.id, to })
        break
      }

      case 'send-batch-email': {
        const { emails } = data
        await sendBatchEmails({
          emails: emails.map((e) => ({
            ...e,
            emailType: 'marketing' as const,
          })),
        })
        workerLogger.info('Batch emails sent', { jobId: context.id, count: emails.length })
        break
      }

      case 'send-welcome-email': {
        await processWelcomeEmail(data, db)
        break
      }

      case 'send-confirmation-email': {
        await processConfirmationEmail(data, db)
        break
      }

      case 'send-newsletter': {
        await processNewsletterSend(data, db)
        break
      }
    }
  } catch (error) {
    workerLogger.error('Email job failed', error as Error, {
      jobId: context.id,
      jobType: data.type,
      attempts: context.attempts,
    })
    throw error
  } finally {
    processTimer()
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

  workerLogger.info('Welcome email sent', { email, writerId: data.writerId })
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

  workerLogger.info('Confirmation email sent', { email, writerId: data.writerId })
}

async function processNewsletterSend(data: SendNewsletterJob, db: any): Promise<void> {
  const { documentId, writerId, campaignId, subscriberIds } = data

  const document = await getDocumentById(db, documentId)
  if (!document) {
    const error = new Error(`Document ${documentId} not found`)
    workerLogger.error('Document not found for newsletter', error, { documentId, campaignId })
    throw error
  }

  const writerSettings = await getWriterNewsletterSettings(db, writerId)
  if (!writerSettings) {
    const error = new Error(`Writer settings for ${writerId} not found`)
    workerLogger.error('Writer settings not found', error, { writerId, campaignId })
    throw error
  }

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

  const batches = []
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    batches.push(subscribers.slice(i, i + BATCH_SIZE))
  }

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
