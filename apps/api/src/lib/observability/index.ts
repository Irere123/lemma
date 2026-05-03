import { flushSentry, initializeSentry } from './sentry'
import { logger } from './logger'

// Sentry integration
export {
  addBreadcrumb,
  captureException,
  captureMessage,
  flushSentry,
  getSentryOptions,
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

export function initializeObservability(options?: {
  sentry?: Parameters<typeof import('./sentry').initializeSentry>[0]
}): void {
  logger.info('Initializing observability services')
  initializeSentry(options?.sentry)
  logger.info('Observability services initialized')
}

export async function shutdownObservability(): Promise<void> {
  logger.info('Shutting down observability services')
  await flushSentry()
  logger.info('Observability services shut down')
}
