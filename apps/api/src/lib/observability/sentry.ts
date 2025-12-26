import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

import { env } from '@api/env-runtime'

const isProduction = env.ENV === 'production'

/**
 * Sentry Configuration
 */
export interface SentryConfig {
  dsn?: string
  environment: string
  release?: string
  tracesSampleRate: number
  profilesSampleRate: number
  debug: boolean
}

const defaultConfig: SentryConfig = {
  dsn: process.env.SENTRY_DSN,
  environment: env.ENV,
  release: process.env.SENTRY_RELEASE || `lemma-api@${process.env.npm_package_version || '1.0.0'}`,
  tracesSampleRate: isProduction ? 0.1 : 1.0, // 10% in production, 100% in dev
  profilesSampleRate: isProduction ? 0.1 : 1.0,
  debug: !isProduction,
}

let isInitialized = false

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
export function initializeSentry(config: Partial<SentryConfig> = {}): typeof Sentry | null {
  const mergedConfig = { ...defaultConfig, ...config }

  // Skip if no DSN is configured
  if (!mergedConfig.dsn) {
    console.log('[Sentry] No DSN configured, skipping initialization')
    return null
  }

  if (isInitialized) {
    console.log('[Sentry] Already initialized')
    return Sentry
  }

  Sentry.init({
    dsn: mergedConfig.dsn,
    environment: mergedConfig.environment,
    release: mergedConfig.release,
    debug: mergedConfig.debug,

    // Performance monitoring
    tracesSampleRate: mergedConfig.tracesSampleRate,
    profilesSampleRate: mergedConfig.profilesSampleRate,

    // Integrations
    integrations: [
      // Profiling integration for performance insights
      nodeProfilingIntegration(),
      // HTTP integration for automatic request tracing
      Sentry.httpIntegration({ spans: true }),
      // Console integration to capture console.error
      Sentry.consoleIntegration(),
    ],

    // Filter sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
        delete event.request.headers['x-api-key']
      }

      // Remove sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.data?.password) {
            breadcrumb.data.password = '[FILTERED]'
          }
          if (breadcrumb.data?.token) {
            breadcrumb.data.token = '[FILTERED]'
          }
          return breadcrumb
        })
      }

      return event
    },

    // Filter transactions
    beforeSendTransaction(event) {
      // Skip health check transactions
      if (event.transaction?.includes('/health') || event.transaction?.includes('/ready')) {
        return null
      }
      return event
    },

    // Ignore common non-error exceptions
    ignoreErrors: [
      // Network errors
      'NetworkError',
      'Network request failed',
      'Failed to fetch',
      // Cancelled requests
      'AbortError',
      'The operation was aborted',
      // Known non-critical errors
      'ResizeObserver loop limit exceeded',
    ],

    // Trace propagation targets
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/.*\.lemma\.now/,
      /^https:\/\/api\.lemma\.now/,
    ],
  })

  isInitialized = true
  console.log(`[Sentry] Initialized for ${mergedConfig.environment}`)

  return Sentry
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
  return isInitialized
}

/**
 * Capture an exception with Sentry
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>
): string | undefined {
  if (!isInitialized) return undefined

  return Sentry.captureException(error, {
    extra: context,
  })
}

/**
 * Capture a message with Sentry
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): string | undefined {
  if (!isInitialized) return undefined

  return Sentry.captureMessage(message, {
    level,
    extra: context,
  })
}

/**
 * Set user context for Sentry
 */
export function setUser(user: { id: string; email?: string; username?: string } | null): void {
  if (!isInitialized) return

  Sentry.setUser(user)
}

/**
 * Set custom tags for the current scope
 */
export function setTags(tags: Record<string, string>): void {
  if (!isInitialized) return

  Object.entries(tags).forEach(([key, value]) => {
    Sentry.setTag(key, value)
  })
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
  category?: string
  message: string
  level?: Sentry.SeverityLevel
  data?: Record<string, unknown>
}): void {
  if (!isInitialized) return

  Sentry.addBreadcrumb({
    category: breadcrumb.category || 'custom',
    message: breadcrumb.message,
    level: breadcrumb.level || 'info',
    data: breadcrumb.data,
    timestamp: Date.now() / 1000,
  })
}

/**
 * Create a new Sentry transaction for custom performance monitoring
 */
export function startTransaction(
  name: string,
  op: string
): ReturnType<typeof Sentry.startInactiveSpan> | undefined {
  if (!isInitialized) return undefined

  return Sentry.startInactiveSpan({
    name,
    op,
  })
}

/**
 * Wrap a function with Sentry error handling
 */
export function withSentry<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options?: { name?: string; op?: string }
): T {
  return ((...args: Parameters<T>) => {
    return Sentry.startSpan(
      {
        name: options?.name || fn.name || 'anonymous',
        op: options?.op || 'function',
      },
      () => {
        try {
          return fn(...args)
        } catch (error) {
          captureException(error)
          throw error
        }
      }
    )
  }) as T
}

/**
 * Flush Sentry events (useful before process exit)
 */
export async function flushSentry(timeout = 2000): Promise<boolean> {
  if (!isInitialized) return true
  return Sentry.flush(timeout)
}

// Re-export Sentry for direct access when needed
export { Sentry }
