// OpenTelemetry instrumentation
export {
  getOpenTelemetrySDK,
  initializeOpenTelemetry,
  shutdownOpenTelemetry,
  type OtelConfig
} from './instrumentation'

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
  type SentryConfig
} from './sentry'

// Structured logging
export {
  Logger,
  logger,
  type LogEntry,
  type LoggerConfig,
  type LogLevel
} from './logger'

// Tracing utilities
export {
  addSpanAttributes,
  addSpanEvent,
  getActiveSpan,
  getSpanId,
  getTraceId,
  getTracer,
  measureTime,
  measureTimeAsync,
  recordException,
  setSpanStatus,
  SpanKind,
  SpanStatusCode,
  withCacheSpan,
  withDatabaseSpan,
  withEmailSpan,
  withHttpClientSpan,
  withJobSpan,
  withResolverSpan,
  withSpan,
  withSpanSync,
  type Span,
  type SpanConfig,
  type Tracer
} from './tracing'

/**
 * Initialize all observability services
 * Call this at the very start of the application
 */
export function initializeObservability(options?: {
  otel?: Parameters<typeof import('./instrumentation').initializeOpenTelemetry>[0]
  sentry?: Parameters<typeof import('./sentry').initializeSentry>[0]
}): void {
  // Import dynamically to ensure proper initialization order
  const { initializeOpenTelemetry } = require('./instrumentation')
  const { initializeSentry } = require('./sentry')
  const { logger } = require('./logger')

  logger.info('Initializing observability services')

  // Initialize OpenTelemetry first (it should be initialized before other modules)
  initializeOpenTelemetry(options?.otel)

  // Initialize Sentry
  initializeSentry(options?.sentry)

  logger.info('Observability services initialized')
}

/**
 * Shutdown all observability services gracefully
 */
export async function shutdownObservability(): Promise<void> {
  const { shutdownOpenTelemetry } = require('./instrumentation')
  const { flushSentry } = require('./sentry')
  const { logger } = require('./logger')

  logger.info('Shutting down observability services')

  // Flush Sentry events
  await flushSentry()

  // Shutdown OpenTelemetry
  await shutdownOpenTelemetry()

  logger.info('Observability services shut down')
}
