import { createAnalyticsWorker } from './analytics-worker'
import { createEmailWorker } from './email-worker'
import { createNewsletterWorker } from './newsletter-worker'
import { createScheduledWorker } from './scheduled-worker'

export { createAnalyticsWorker } from './analytics-worker'
export { createEmailWorker } from './email-worker'
export { createNewsletterWorker } from './newsletter-worker'
export { createScheduledWorker } from './scheduled-worker'

let workers: ReturnType<typeof createAllWorkers> | null = null

export function createAllWorkers() {
  return {
    email: createEmailWorker(),
    newsletter: createNewsletterWorker(),
    analytics: createAnalyticsWorker(),
    scheduled: createScheduledWorker(),
  }
}

export function startWorkers() {
  if (workers) {
    console.log('Workers already started')
    return workers
  }

  console.log('Starting all background workers...')
  workers = createAllWorkers()
  console.log('All workers started successfully')
  return workers
}

export async function stopWorkers() {
  if (!workers) {
    return
  }

  console.log('Stopping all background workers...')

  await Promise.all([
    workers.email.close(),
    workers.newsletter.close(),
    workers.analytics.close(),
    workers.scheduled.close(),
  ])

  workers = null
  console.log('All workers stopped')
}

export function getWorkers() {
  return workers
}
