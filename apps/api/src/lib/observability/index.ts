// Sentry integration
export {
  addBreadcrumb,
  captureException,
  captureMessage,
  flushSentry,
  initializeSentry,
  isSentryInitialized,
  Sentry,
  setTags,
  setUser,
  startTransaction,
  withSentry,
  type SentryConfig,
} from './sentry'

// Structured logging
export {
  Logger,
  logger,
  type LogEntry,
  type LoggerConfig,
  type LogLevel,
} from './logger'

/**
 * Initialize all observability services
 * Call this at the very start of the application
 */
export function initializeObservability(options?: {
  sentry?: Parameters<typeof import('./sentry').initializeSentry>[0]
}): void {
  const { initializeSentry } = require('./sentry')
  const { logger } = require('./logger')

  logger.info('Initializing observability services')

  // Initialize Sentry
  initializeSentry(options?.sentry)

  logger.info('Observability services initialized')
}

/**
 * Shutdown all observability services gracefully
 */
export async function shutdownObservability(): Promise<void> {
  const { flushSentry } = require('./sentry')
  const { logger } = require('./logger')

  logger.info('Shutting down observability services')

  // Flush Sentry events
  await flushSentry()

  logger.info('Observability services shut down')
}
