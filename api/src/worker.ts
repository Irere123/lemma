import 'dotenv/config'
import { startWorkers, stopWorkers } from './jobs/workers'
import { closeAllQueues } from './jobs/queues'

console.log('Starting Lemma background worker process...')

// Start all workers
const workers = startWorkers()

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`)

  try {
    await stopWorkers()
    await closeAllQueues()
    console.log('Shutdown complete')
    process.exit(0)
  } catch (error) {
    console.error('Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Keep the process running
console.log('Workers are running. Press Ctrl+C to stop.')
