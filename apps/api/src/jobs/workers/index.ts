import { logger } from '@api/lib/observability'
import { createAnalyticsWorker } from './analytics-worker'
import { createEmailWorker } from './email-worker'
import { createNewsletterWorker } from './newsletter-worker'
import { createScheduledWorker } from './scheduled-worker'

export { createAnalyticsWorker } from './analytics-worker'
export { createEmailWorker } from './email-worker'
export { createNewsletterWorker } from './newsletter-worker'
export { createScheduledWorker } from './scheduled-worker'

const workerLogger = logger.child({ component: 'jobs', subcomponent: 'workers' })

let workers: ReturnType<typeof createAllWorkers> | null = null

export function createAllWorkers() {
  const timer = workerLogger.time('create-all-workers')
  const workers = {
    email: createEmailWorker(),
    newsletter: createNewsletterWorker(),
    analytics: createAnalyticsWorker(),
    scheduled: createScheduledWorker(),
  }
  timer()
  workerLogger.info('All workers created')
  return workers
}

export function startWorkers() {
  if (workers) {
    workerLogger.warn('Workers already started')
    return workers
  }

  workerLogger.info('Starting all background workers...')
  const timer = workerLogger.time('start-all-workers')
  workers = createAllWorkers()
  timer()
  workerLogger.info('All workers started successfully')
  return workers
}

export async function stopWorkers() {
  if (!workers) {
    return
  }

  workerLogger.info('Stopping all background workers...')
  const timer = workerLogger.time('stop-all-workers')

  try {
    await Promise.all([
      workers.email.close(),
      workers.newsletter.close(),
      workers.analytics.close(),
      workers.scheduled.close(),
    ])

    workers = null
    workerLogger.info('All workers stopped successfully')
  } catch (error) {
    workerLogger.error('Error stopping workers', error as Error)
    throw error
  } finally {
    timer()
  }
}

export function getWorkers() {
  return workers
}
