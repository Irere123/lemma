import 'dotenv/config'
import { closeAllQueues } from './jobs/queues'
import { startWorkers, stopWorkers } from './jobs/workers'
import { initializeObservability, logger, shutdownObservability } from './lib/observability'

initializeObservability()

const workerLogger = logger.child({ component: 'worker-process' })

workerLogger.info('Starting Lemma background worker process...')

// Start all workers
startWorkers()
workerLogger.info('All workers started successfully')

// Graceful shutdown
const shutdown = async (signal: string) => {
  workerLogger.info(`Received ${signal}, shutting down gracefully...`)

  try {
    await stopWorkers()
    await closeAllQueues()
    await shutdownObservability()
    workerLogger.info('Shutdown complete')
    process.exit(0)
  } catch (error) {
    workerLogger.error('Error during shutdown', error as Error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Keep the process running
workerLogger.info('Workers are running. Press Ctrl+C to stop.')
