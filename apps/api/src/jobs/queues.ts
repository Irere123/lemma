import { Queue } from 'bullmq'

import { logger } from '@api/lib/observability'
import { defaultJobOptions, getRedisConnection, QUEUE_NAMES } from './queue-config'
import type { AnalyticsJobData, EmailJobData, NewsletterJobData, ScheduledJobData } from './types'

const jobLogger = logger.child({ component: 'jobs' })

let emailQueue: Queue<EmailJobData> | null = null
let newsletterQueue: Queue<NewsletterJobData> | null = null
let analyticsQueue: Queue<AnalyticsJobData> | null = null
let scheduledQueue: Queue<ScheduledJobData> | null = null

export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobData>(QUEUE_NAMES.EMAIL, {
      connection: getRedisConnection(),
      defaultJobOptions,
    })
    jobLogger.info('Email queue initialized', { queueName: QUEUE_NAMES.EMAIL })
  }
  return emailQueue
}

export function getNewsletterQueue(): Queue<NewsletterJobData> {
  if (!newsletterQueue) {
    newsletterQueue = new Queue<NewsletterJobData>(QUEUE_NAMES.NEWSLETTER, {
      connection: getRedisConnection(),
      defaultJobOptions,
    })
    jobLogger.info('Newsletter queue initialized', { queueName: QUEUE_NAMES.NEWSLETTER })
  }
  return newsletterQueue
}

export function getAnalyticsQueue(): Queue<AnalyticsJobData> {
  if (!analyticsQueue) {
    analyticsQueue = new Queue<AnalyticsJobData>(QUEUE_NAMES.ANALYTICS, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 1, // Analytics jobs don't need retries
      },
    })
    jobLogger.info('Analytics queue initialized', { queueName: QUEUE_NAMES.ANALYTICS })
  }
  return analyticsQueue
}

export function getScheduledQueue(): Queue<ScheduledJobData> {
  if (!scheduledQueue) {
    scheduledQueue = new Queue<ScheduledJobData>(QUEUE_NAMES.SCHEDULED, {
      connection: getRedisConnection(),
      defaultJobOptions,
    })
    jobLogger.info('Scheduled queue initialized', { queueName: QUEUE_NAMES.SCHEDULED })
  }
  return scheduledQueue
}

export async function closeAllQueues(): Promise<void> {
  const closeTimer = jobLogger.time('close-all-queues')
  const queues = [emailQueue, newsletterQueue, analyticsQueue, scheduledQueue]

  try {
    await Promise.all(queues.filter(Boolean).map((q) => q!.close()))
    emailQueue = null
    newsletterQueue = null
    analyticsQueue = null
    scheduledQueue = null
    jobLogger.info('All queues closed successfully')
  } catch (error) {
    jobLogger.error('Error closing queues', error as Error)
    throw error
  } finally {
    closeTimer()
  }
}

export { QUEUE_NAMES }
