import * as Sentry from '@sentry/cloudflare'

import { createApp } from './app'
import { type CloudflareBindings, setRuntimeEnv } from './env-runtime'
import { processQueueBatch, type QueueBatch } from './jobs/consumer'
import { processDueScheduledJobs } from './jobs/scheduler'
import type { JobData } from './jobs/types'
import {
  captureException,
  getSentryOptions,
  initializeObservability,
  logger,
} from './lib/observability'

type ExecutionContextLike = {
  waitUntil?: (promise: Promise<unknown>) => void
}

type ScheduledEventLike = {
  cron?: string
  scheduledTime?: number
}

let app: ReturnType<typeof createApp> | null = null
let observabilityInitialized = false

function prepareRuntime(env: CloudflareBindings) {
  setRuntimeEnv(env)

  if (!observabilityInitialized) {
    initializeObservability()
    observabilityInitialized = true
  }

  if (!app) {
    app = createApp()
  }

  return app
}

const handler = {
  async fetch(request: Request, env: CloudflareBindings, ctx: ExecutionContextLike) {
    try {
      const app = prepareRuntime(env)
      return app.fetch(request, env, ctx as never)
    } catch (error) {
      captureException(error)
      logger.error('Unhandled Worker fetch error', error as Error, {
        url: request.url,
      })
      throw error
    }
  },

  async queue(batch: QueueBatch, env: CloudflareBindings, _ctx: ExecutionContextLike) {
    try {
      prepareRuntime(env)
      await processQueueBatch(batch)
    } catch (error) {
      captureException(error)
      logger.error('Unhandled Worker queue error', error as Error, {
        queue: batch.queue,
      })
      throw error
    }
  },

  async scheduled(event: ScheduledEventLike, env: CloudflareBindings, ctx: ExecutionContextLike) {
    prepareRuntime(env)
    const work = processDueScheduledJobs(new Date(event.scheduledTime ?? Date.now())).catch(
      (error) => {
        captureException(error)
        logger.error('Unhandled Worker scheduled error', error as Error, {
          cron: event.cron,
        })
        throw error
      }
    )

    ctx.waitUntil?.(work)
    await work
  },
}

export default Sentry.withSentry<CloudflareBindings, JobData>((env) => {
  setRuntimeEnv(env)
  const options = getSentryOptions()
  return options.dsn ? options : undefined
}, handler as never)
