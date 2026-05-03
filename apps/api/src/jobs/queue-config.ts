export const MAX_QUEUE_DELAY_SECONDS = 24 * 60 * 60

export const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
}

export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  NEWSLETTER: 'newsletter-queue',
  ANALYTICS: 'analytics-queue',
  SCHEDULED: 'scheduled-queue',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

export function toDelaySeconds(delayMs?: number): number | undefined {
  if (!delayMs || delayMs <= 0) return undefined
  return Math.min(Math.ceil(delayMs / 1000), MAX_QUEUE_DELAY_SECONDS)
}

export function isDelayWithinQueueLimit(delayMs: number): boolean {
  return delayMs <= MAX_QUEUE_DELAY_SECONDS * 1000
}
