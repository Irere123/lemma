import { logger } from '@api/lib/observability'
import type { JobData } from './types'
import { processAnalyticsJob } from './workers/analytics-worker'
import { processEmailJob } from './workers/email-worker'
import { processNewsletterJob } from './workers/newsletter-worker'
import { processScheduledJob } from './workers/scheduled-worker'

const consumerLogger = logger.child({ component: 'jobs', subcomponent: 'queue-consumer' })

export type QueueMessage<T = JobData> = {
  readonly id: string
  readonly body: T
  readonly attempts: number
  ack?: () => void
  retry?: (options?: { delaySeconds?: number }) => void
}

export type QueueBatch<T = JobData> = {
  readonly queue: string
  readonly messages: readonly QueueMessage<T>[]
  retryAll?: (options?: { delaySeconds?: number }) => void
  ackAll?: () => void
}

function retryDelaySeconds(attempts: number) {
  return Math.min(2 ** Math.max(attempts - 1, 0) * 30, 15 * 60)
}

export async function processJobData(
  data: JobData,
  context: { id?: string; attempts?: number } = {}
) {
  switch (data.type) {
    case 'send-single-email':
    case 'send-batch-email':
    case 'send-welcome-email':
    case 'send-confirmation-email':
    case 'send-newsletter':
      await processEmailJob(data, context)
      return

    case 'process-newsletter-batch':
    case 'schedule-newsletter':
    case 'send-ab-test':
      await processNewsletterJob(data, context)
      return

    case 'track-click':
    case 'track-open':
    case 'aggregate-campaign-stats':
      await processAnalyticsJob(data, context)
      return

    case 'publish-scheduled-document':
    case 'send-scheduled-newsletter':
      await processScheduledJob(data, context)
      return
  }
}

export async function processQueueBatch(batch: QueueBatch<JobData>) {
  for (const message of batch.messages) {
    try {
      await processJobData(message.body, {
        id: message.id,
        attempts: message.attempts,
      })
      message.ack?.()
    } catch (error) {
      consumerLogger.error('Queue message failed', error as Error, {
        messageId: message.id,
        queue: batch.queue,
        attempts: message.attempts,
        jobType: message.body?.type,
      })
      message.retry?.({ delaySeconds: retryDelaySeconds(message.attempts) })
    }
  }
}
