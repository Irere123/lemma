import { env } from '@api/env-runtime'
import type { ConnectionOptions } from 'bullmq'

export const getRedisConnection = (): ConnectionOptions => {
  const redisUrl = new URL(env.REDIS_URL)

  return {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port || '6379', 10),
    password: redisUrl.password || undefined,
    username: redisUrl.username || undefined,
    maxRetriesPerRequest: null,
  }
}

export const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: {
    count: 1000,
    age: 24 * 60 * 60, // 24 hours
  },
  removeOnFail: {
    count: 5000,
    age: 7 * 24 * 60 * 60, // 7 days
  },
}

export const QUEUE_NAMES = {
  EMAIL: 'email-queue',
  NEWSLETTER: 'newsletter-queue',
  ANALYTICS: 'analytics-queue',
  SCHEDULED: 'scheduled-queue',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]
