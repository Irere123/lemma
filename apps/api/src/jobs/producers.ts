import { logger } from '@api/lib/observability'
import { withJobSpan } from '@api/lib/observability/tracing'
import { getAnalyticsQueue, getEmailQueue, getNewsletterQueue, getScheduledQueue } from './queues'
import type {
  AggregateCampaignStatsJob,
  ProcessNewsletterBatchJob,
  PublishScheduledDocumentJob,
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

// Email Jobs
export async function enqueueSingleEmail(
  data: Omit<SendSingleEmailJob, 'type'>,
  options?: { priority?: number; delay?: number }
) {
  return withJobSpan('enqueue-single-email', 'send-single-email', async (span) => {
    const queue = getEmailQueue()
    const job = await queue.add(
      'send-single-email',
      { type: 'send-single-email', ...data },
      {
        priority: options?.priority ?? 5,
        delay: options?.delay,
      }
    )

    span.setAttribute('job.id', job.id!)
    span.setAttribute('job.priority', options?.priority ?? 5)
    jobLogger.info('Single email job enqueued', { jobId: job.id, to: data.to })

    return job
  })
}

export async function enqueueBatchEmail(
  data: Omit<SendBatchEmailJob, 'type'>,
  options?: { priority?: number }
) {
  return withJobSpan('enqueue-batch-email', 'send-batch-email', async (span) => {
    const queue = getEmailQueue()
    const job = await queue.add(
      'send-batch-email',
      { type: 'send-batch-email', ...data },
      {
        priority: options?.priority ?? 3,
      }
    )

    span.setAttribute('job.id', job.id!)
    span.setAttribute('job.emailCount', data.emails.length)
    jobLogger.info('Batch email job enqueued', { jobId: job.id, emailCount: data.emails.length })

    return job
  })
}

export async function enqueueWelcomeEmail(
  data: Omit<SendWelcomeEmailJob, 'type'>,
  options?: { delay?: number; priority?: number }
) {
  const queue = getEmailQueue()
  return queue.add(
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
  const queue = getEmailQueue()
  return queue.add(
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
  const queue = getEmailQueue()
  return queue.add(
    'send-newsletter',
    { type: 'send-newsletter', ...data },
    {
      priority: options?.priority ?? 5,
      delay: options?.delay,
    }
  )
}

// Newsletter Jobs
export async function enqueueNewsletterBatch(
  data: Omit<ProcessNewsletterBatchJob, 'type'>,
  options?: { priority?: number }
) {
  const queue = getNewsletterQueue()
  return queue.add(
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
  const queue = getNewsletterQueue()
  const scheduledDate = new Date(data.scheduledAt)
  const delay = Math.max(0, scheduledDate.getTime() - Date.now())

  return queue.add(
    'schedule-newsletter',
    { type: 'schedule-newsletter', ...data },
    {
      priority: options?.priority ?? 5,
      delay,
    }
  )
}

export async function enqueueABTest(
  data: Omit<SendABTestJob, 'type'>,
  options?: { priority?: number }
) {
  const queue = getNewsletterQueue()
  return queue.add(
    'send-ab-test',
    { type: 'send-ab-test', ...data },
    {
      priority: options?.priority ?? 5,
    }
  )
}

// Analytics Jobs
export async function trackClick(data: Omit<TrackClickJob, 'type'>) {
  return withJobSpan('track-click', 'analytics', async (span) => {
    const queue = getAnalyticsQueue()
    const job = await queue.add('track-click', { type: 'track-click', ...data })

    span.setAttribute('job.id', job.id!)
    span.setAttribute('analytics.subscriberId', data.subscriberId)
    span.setAttribute('analytics.campaignId', data.campaignId)
    jobLogger.debug('Click tracking job enqueued', {
      jobId: job.id,
      subscriberId: data.subscriberId,
    })

    return job
  })
}

export async function trackOpen(data: Omit<TrackOpenJob, 'type'>) {
  const queue = getAnalyticsQueue()
  return queue.add('track-open', { type: 'track-open', ...data })
}

export async function aggregateCampaignStats(data: Omit<AggregateCampaignStatsJob, 'type'>) {
  const queue = getAnalyticsQueue()
  return queue.add('aggregate-campaign-stats', { type: 'aggregate-campaign-stats', ...data })
}

// Scheduled Jobs
export async function scheduleDocumentPublish(
  data: Omit<PublishScheduledDocumentJob, 'type'>,
  scheduledAt: Date
) {
  const queue = getScheduledQueue()
  const delay = Math.max(0, scheduledAt.getTime() - Date.now())

  return queue.add(
    'publish-scheduled-document',
    { type: 'publish-scheduled-document', ...data },
    {
      delay,
      jobId: `publish-${data.documentId}`,
    }
  )
}

export async function scheduleNewsletterSend(
  data: Omit<SendScheduledNewsletterJob, 'type'>,
  scheduledAt: Date
) {
  const queue = getScheduledQueue()
  const delay = Math.max(0, scheduledAt.getTime() - Date.now())

  return queue.add(
    'send-scheduled-newsletter',
    { type: 'send-scheduled-newsletter', ...data },
    {
      delay,
      jobId: `newsletter-${data.campaignId}`,
    }
  )
}

// Utility functions
export async function cancelScheduledJob(jobId: string) {
  const queue = getScheduledQueue()
  const job = await queue.getJob(jobId)
  if (job) {
    await job.remove()
    return true
  }
  return false
}

export async function getJobStatus(
  queueName: 'email' | 'newsletter' | 'analytics' | 'scheduled',
  jobId: string
) {
  return withJobSpan('get-job-status', 'query', async (span) => {
    const queues = {
      email: getEmailQueue,
      newsletter: getNewsletterQueue,
      analytics: getAnalyticsQueue,
      scheduled: getScheduledQueue,
    }

    const queue = queues[queueName]()
    const job = await queue.getJob(jobId)

    if (!job) {
      jobLogger.warn('Job not found', { queueName, jobId })
      return null
    }

    const state = await job.getState()
    span.setAttribute('job.state', state)
    span.setAttribute('job.attempts', job.attemptsMade)

    jobLogger.debug('Job status retrieved', { queueName, jobId, state })

    return {
      id: job.id,
      name: job.name,
      state,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    }
  })
}
