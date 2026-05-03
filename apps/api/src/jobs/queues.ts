import { getRuntimeBindings, type QueueBinding } from '@api/env-runtime'
import type {
  AnalyticsJobData,
  EmailJobData,
  JobData,
  NewsletterJobData,
  ScheduledJobData,
} from './types'
import { QUEUE_NAMES } from './queue-config'

export function getEmailQueue(): QueueBinding<EmailJobData | JobData> | null {
  return (
    (getRuntimeBindings().EMAIL_QUEUE as QueueBinding<EmailJobData | JobData> | undefined) ?? null
  )
}

export function getNewsletterQueue(): QueueBinding<NewsletterJobData | JobData> | null {
  return (
    (getRuntimeBindings().NEWSLETTER_QUEUE as
      | QueueBinding<NewsletterJobData | JobData>
      | undefined) ?? null
  )
}

export function getAnalyticsQueue(): QueueBinding<AnalyticsJobData | JobData> | null {
  return (
    (getRuntimeBindings().ANALYTICS_QUEUE as
      | QueueBinding<AnalyticsJobData | JobData>
      | undefined) ?? null
  )
}

export function getScheduledQueue(): QueueBinding<ScheduledJobData | JobData> | null {
  return (
    (getRuntimeBindings().SCHEDULED_QUEUE as
      | QueueBinding<ScheduledJobData | JobData>
      | undefined) ?? null
  )
}

export { QUEUE_NAMES }
