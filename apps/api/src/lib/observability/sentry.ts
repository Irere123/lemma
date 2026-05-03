import * as Sentry from '@sentry/cloudflare'

import { getEnv } from '@api/env-runtime'
import { isProduction } from '@api/lib/constants'

export interface SentryConfig {
  dsn?: string
  environment: string
  release?: string
  tracesSampleRate: number
  profilesSampleRate: number
  debug: boolean
}

let isInitialized = false

function defaultConfig(): SentryConfig {
  const env = getEnv()
  const production = isProduction()

  return {
    dsn: env.SENTRY_DSN,
    environment: env.ENV,
    release: env.SENTRY_RELEASE || 'lemma-api@1.0.0',
    tracesSampleRate: production ? 0.1 : 1.0,
    profilesSampleRate: production ? 0.1 : 1.0,
    debug: !production,
  }
}

export function getSentryOptions(config: Partial<SentryConfig> = {}) {
  const mergedConfig = { ...defaultConfig(), ...config }

  return {
    dsn: mergedConfig.dsn,
    environment: mergedConfig.environment,
    release: mergedConfig.release,
    debug: mergedConfig.debug,
    tracesSampleRate: mergedConfig.tracesSampleRate,
    beforeSend(event: any) {
      if (event.request?.headers) {
        event.request.headers.authorization = undefined
        event.request.headers.cookie = undefined
        event.request.headers['x-api-key'] = undefined
      }

      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb: any) => {
          if (breadcrumb.data?.password) breadcrumb.data.password = '[FILTERED]'
          if (breadcrumb.data?.token) breadcrumb.data.token = '[FILTERED]'
          return breadcrumb
        })
      }

      return event
    },
    beforeSendTransaction(event: any) {
      if (event.transaction?.includes('/health') || event.transaction?.includes('/ready')) {
        return null
      }
      return event
    },
    ignoreErrors: [
      'NetworkError',
      'Network request failed',
      'Failed to fetch',
      'AbortError',
      'The operation was aborted',
      'ResizeObserver loop limit exceeded',
    ],
    tracePropagationTargets: [
      /^http:\/\/localhost:\d+/,
      /^https:\/\/api\.irere\.dev/,
      /^https:\/\/irere\.dev/,
    ],
  }
}

export function initializeSentry(config: Partial<SentryConfig> = {}): typeof Sentry | null {
  const options = getSentryOptions(config)

  if (!options.dsn) {
    console.log('[Sentry] No DSN configured, skipping initialization')
    return null
  }

  isInitialized = true
  console.log(`[Sentry] Cloudflare SDK configured for ${options.environment}`)

  return Sentry
}

export function isSentryInitialized(): boolean {
  return isInitialized || Sentry.isInitialized()
}

export function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>
): string | undefined {
  if (!isSentryInitialized()) return undefined

  return Sentry.captureException(error, {
    extra: context,
  })
}

export function captureMessage(
  message: string,
  level: any = 'info',
  context?: Record<string, unknown>
): string | undefined {
  if (!isSentryInitialized()) return undefined

  return Sentry.captureMessage(message, {
    level,
    extra: context,
  })
}

export function setUser(user: { id: string; email?: string; username?: string } | null): void {
  if (!isSentryInitialized()) return

  Sentry.setUser(user)
}

export function setTags(tags: Record<string, string>): void {
  if (!isSentryInitialized()) return

  Object.entries(tags).forEach(([key, value]) => {
    Sentry.setTag(key, value)
  })
}

export function addBreadcrumb(breadcrumb: {
  category?: string
  message: string
  level?: any
  data?: Record<string, unknown>
}): void {
  if (!isSentryInitialized()) return

  Sentry.addBreadcrumb({
    category: breadcrumb.category || 'custom',
    message: breadcrumb.message,
    level: breadcrumb.level || 'info',
    data: breadcrumb.data,
    timestamp: Date.now() / 1000,
  })
}

export function startTransaction(
  name: string,
  op: string
): ReturnType<typeof Sentry.startInactiveSpan> | undefined {
  if (!isSentryInitialized()) return undefined

  return Sentry.startInactiveSpan({
    name,
    op,
  })
}

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

export async function flushSentry(timeout = 2000): Promise<boolean> {
  if (!isSentryInitialized()) return true
  return Sentry.flush(timeout)
}

export { Sentry }
