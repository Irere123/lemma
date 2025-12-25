import { getEmailQueue, getNewsletterQueue, getAnalyticsQueue, getScheduledQueue } from './queues'
import type {
  SendSingleEmailJob,
  SendBatchEmailJob,
  SendWelcomeEmailJob,
  SendConfirmationEmailJob,
  SendNewsletterJob,
  ProcessNewsletterBatchJob,
  ScheduleNewsletterJob,
  SendABTestJob,
  TrackClickJob,
  TrackOpenJob,
  AggregateCampaignStatsJob,
  PublishScheduledDocumentJob,
  SendScheduledNewsletterJob,
} from './types'

// Email Jobs
export async function enqueueSingleEmail(
  data: Omit<SendSingleEmailJob, 'type'>,
  options?: { priority?: number; delay?: number }
) {
  const queue = getEmailQueue()
  return queue.add(
    'send-single-email',
    { type: 'send-single-email', ...data },
    {
      priority: options?.priority ?? 5,
      delay: options?.delay,
    }
  )
}

export async function enqueueBatchEmail(
  data: Omit<SendBatchEmailJob, 'type'>,
  options?: { priority?: number }
) {
  const queue = getEmailQueue()
  return queue.add(
    'send-batch-email',
    { type: 'send-batch-email', ...data },
    {
      priority: options?.priority ?? 3,
    }
  )
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
  const queue = getAnalyticsQueue()
  return queue.add('track-click', { type: 'track-click', ...data })
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
  const queues = {
    email: getEmailQueue,
    newsletter: getNewsletterQueue,
    analytics: getAnalyticsQueue,
    scheduled: getScheduledQueue,
  }

  const queue = queues[queueName]()
  const job = await queue.getJob(jobId)

  if (!job) {
    return null
  }

  return {
    id: job.id,
    name: job.name,
    state: await job.getState(),
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  }
}
