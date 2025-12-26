import { Queue } from 'bullmq'

import { defaultJobOptions, getRedisConnection, QUEUE_NAMES } from './queue-config'
import type { AnalyticsJobData, EmailJobData, NewsletterJobData, ScheduledJobData } from './types'

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
  }
  return emailQueue
}

export function getNewsletterQueue(): Queue<NewsletterJobData> {
  if (!newsletterQueue) {
    newsletterQueue = new Queue<NewsletterJobData>(QUEUE_NAMES.NEWSLETTER, {
      connection: getRedisConnection(),
      defaultJobOptions,
    })
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
  }
  return analyticsQueue
}

export function getScheduledQueue(): Queue<ScheduledJobData> {
  if (!scheduledQueue) {
    scheduledQueue = new Queue<ScheduledJobData>(QUEUE_NAMES.SCHEDULED, {
      connection: getRedisConnection(),
      defaultJobOptions,
    })
  }
  return scheduledQueue
}

export async function closeAllQueues(): Promise<void> {
  const queues = [emailQueue, newsletterQueue, analyticsQueue, scheduledQueue]
  await Promise.all(queues.filter(Boolean).map((q) => q!.close()))
  emailQueue = null
  newsletterQueue = null
  analyticsQueue = null
  scheduledQueue = null
}

export { QUEUE_NAMES }
