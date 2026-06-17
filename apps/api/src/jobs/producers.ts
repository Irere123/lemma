import type { QueueBinding } from '@api/env-runtime'
import { logger } from '@api/lib/observability'
import { generateId } from '@api/lib/utils'
import {
  isDelayWithinQueueLimit,
  MAX_QUEUE_DELAY_SECONDS,
  QUEUE_NAMES,
  toDelaySeconds,
} from './queue-config'
import { getAnalyticsQueue, getEmailQueue, getNewsletterQueue, getScheduledQueue } from './queues'
import type {
  AggregateCampaignStatsJob,
  AnalyticsJobData,
  EmailJobData,
  JobData,
  NewsletterJobData,
  ProcessNewsletterBatchJob,
  PublishScheduledDocumentJob,
  ScheduledJobData,
  ScheduleNewsletterJob,
  SendABTestJob,
  SendBatchEmailJob,
  SendConfirmationEmailJob,
  SendNewsletterJob,
  SendScheduledNewsletterJob,
  SendSingleEmailJob,
  SendWelcomeEmailJob,
  TrackClickJob,
  TrackOpenJob,
} from './types'

const jobLogger = logger.child({ component: 'jobs', subcomponent: 'producers' })

export type QueuedJob<T extends JobData = JobData> = {
  id: string
  name: string
  data: T
  queueName: string
}

type EnqueueOptions = {
  priority?: number
  delay?: number
  jobId?: string
  skipInline?: boolean
}

async function processInline(data: JobData, delay?: number) {
  // Inline execution only runs when no queue binding is configured (local dev).
  // A delayed setTimeout is NOT durable on Workers — the isolate can be evicted
  // before it fires, silently dropping the job. Run immediately instead and warn
  // that the delay was ignored, so the job is never lost.
  if (delay && delay > 0) {
    jobLogger.warn('No queue binding; running delayed job immediately (delay ignored)', {
      delay,
      jobType: (data as { type?: string }).type,
    })
  }

  const { processJobData } = await import('./consumer')
  await processJobData(data)
}

async function enqueueJob<T extends JobData>(
  queue: QueueBinding<T | JobData> | null,
  queueName: string,
  name: string,
  data: T,
  options?: EnqueueOptions
): Promise<QueuedJob<T>> {
  const id = options?.jobId ?? generateId('job')
  const delaySeconds = toDelaySeconds(options?.delay)

  if (queue) {
    await queue.send(data, delaySeconds ? { delaySeconds } : undefined)
  } else if (!options?.skipInline) {
    await processInline(data, options?.delay)
  } else {
    jobLogger.info('Job persisted in database for scheduled worker pickup', {
      queueName,
      name,
      delayMs: options?.delay,
    })
  }

  return { id, name, data, queueName }
}

export async function enqueueSingleEmail(
  data: Omit<SendSingleEmailJob, 'type'>,
  options?: { priority?: number; delay?: number }
) {
  const job = await enqueueJob<EmailJobData>(
    getEmailQueue(),
    QUEUE_NAMES.EMAIL,
    'send-single-email',
    { type: 'send-single-email', ...data },
    options
  )

  jobLogger.info('Single email job enqueued', { jobId: job.id, to: data.to })

  return job
}

export async function enqueueBatchEmail(
  data: Omit<SendBatchEmailJob, 'type'>,
  options?: { priority?: number }
) {
  const job = await enqueueJob<EmailJobData>(
    getEmailQueue(),
    QUEUE_NAMES.EMAIL,
    'send-batch-email',
    { type: 'send-batch-email', ...data },
    options
  )

  jobLogger.info('Batch emails job enqueued', { jobId: job.id, emailCount: data.emails.length })

  return job
}

export async function enqueueWelcomeEmail(
  data: Omit<SendWelcomeEmailJob, 'type'>,
  options?: { delay?: number; priority?: number }
) {
  return enqueueJob<EmailJobData>(
    getEmailQueue(),
    QUEUE_NAMES.EMAIL,
    'send-welcome-email',
    { type: 'send-welcome-email', ...data },
    {
      priority: options?.priority ?? 9,
      delay: options?.delay ?? 0,
    }
  )
}

export async function enqueueConfirmationEmail(
  data: Omit<SendConfirmationEmailJob, 'type'>,
  options?: { priority?: number }
) {
  return enqueueJob<EmailJobData>(
    getEmailQueue(),
    QUEUE_NAMES.EMAIL,
    'send-confirmation-email',
    { type: 'send-confirmation-email', ...data },
    {
      priority: options?.priority ?? 10,
    }
  )
}

export async function enqueueNewsletter(
  data: Omit<SendNewsletterJob, 'type'>,
  options?: { priority?: number; delay?: number }
) {
  return enqueueJob<EmailJobData>(
    getEmailQueue(),
    QUEUE_NAMES.EMAIL,
    'send-newsletter',
    { type: 'send-newsletter', ...data },
    {
      priority: options?.priority ?? 5,
      delay: options?.delay,
    }
  )
}

export async function enqueueNewsletterBatch(
  data: Omit<ProcessNewsletterBatchJob, 'type'>,
  options?: { priority?: number }
) {
  return enqueueJob<NewsletterJobData>(
    getNewsletterQueue(),
    QUEUE_NAMES.NEWSLETTER,
    'process-newsletter-batch',
    { type: 'process-newsletter-batch', ...data },
    {
      priority: options?.priority ?? 5,
    }
  )
}

export async function scheduleNewsletter(
  data: Omit<ScheduleNewsletterJob, 'type'>,
  options?: { priority?: number }
) {
  const scheduledDate = new Date(data.scheduledAt)
  const delay = Math.max(0, scheduledDate.getTime() - Date.now())
  const withinQueueLimit = isDelayWithinQueueLimit(delay)

  return enqueueJob<NewsletterJobData>(
    getNewsletterQueue(),
    QUEUE_NAMES.NEWSLETTER,
    'schedule-newsletter',
    { type: 'schedule-newsletter', ...data },
    {
      priority: options?.priority ?? 5,
      delay: withinQueueLimit ? delay : MAX_QUEUE_DELAY_SECONDS * 1000,
      skipInline: !withinQueueLimit,
    }
  )
}

export async function enqueueABTest(
  data: Omit<SendABTestJob, 'type'>,
  options?: { priority?: number }
) {
  return enqueueJob<NewsletterJobData>(
    getNewsletterQueue(),
    QUEUE_NAMES.NEWSLETTER,
    'send-ab-test',
    { type: 'send-ab-test', ...data },
    {
      priority: options?.priority ?? 5,
    }
  )
}

export async function trackClick(data: Omit<TrackClickJob, 'type'>) {
  const job = await enqueueJob<AnalyticsJobData>(
    getAnalyticsQueue(),
    QUEUE_NAMES.ANALYTICS,
    'track-click',
    { type: 'track-click', ...data }
  )

  jobLogger.debug('Click tracking job enqueued', {
    jobId: job.id,
    subscriberId: data.subscriberId,
  })

  return job
}

export async function trackOpen(data: Omit<TrackOpenJob, 'type'>) {
  return enqueueJob<AnalyticsJobData>(getAnalyticsQueue(), QUEUE_NAMES.ANALYTICS, 'track-open', {
    type: 'track-open',
    ...data,
  })
}

export async function aggregateCampaignStats(data: Omit<AggregateCampaignStatsJob, 'type'>) {
  return enqueueJob<AnalyticsJobData>(
    getAnalyticsQueue(),
    QUEUE_NAMES.ANALYTICS,
    'aggregate-campaign-stats',
    { type: 'aggregate-campaign-stats', ...data }
  )
}

export async function scheduleDocumentPublish(
  data: Omit<PublishScheduledDocumentJob, 'type'>,
  scheduledAt: Date
) {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now())
  const withinQueueLimit = isDelayWithinQueueLimit(delay)

  return enqueueJob<ScheduledJobData>(
    getScheduledQueue(),
    QUEUE_NAMES.SCHEDULED,
    'publish-scheduled-document',
    { type: 'publish-scheduled-document', ...data },
    {
      delay: withinQueueLimit ? delay : MAX_QUEUE_DELAY_SECONDS * 1000,
      jobId: `publish-${data.documentId}`,
      skipInline: !withinQueueLimit,
    }
  )
}

export async function scheduleNewsletterSend(
  data: Omit<SendScheduledNewsletterJob, 'type'>,
  scheduledAt: Date
) {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now())
  const withinQueueLimit = isDelayWithinQueueLimit(delay)

  return enqueueJob<ScheduledJobData>(
    getScheduledQueue(),
    QUEUE_NAMES.SCHEDULED,
    'send-scheduled-newsletter',
    { type: 'send-scheduled-newsletter', ...data },
    {
      delay: withinQueueLimit ? delay : MAX_QUEUE_DELAY_SECONDS * 1000,
      jobId: `newsletter-${data.campaignId}`,
      skipInline: !withinQueueLimit,
    }
  )
}

export async function cancelScheduledJob(jobId: string) {
  jobLogger.warn('Cloudflare Queues does not support removing an enqueued delayed message', {
    jobId,
  })
  return false
}
