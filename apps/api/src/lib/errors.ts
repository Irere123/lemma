import type { Context, ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

import { isProduction } from './constants'
import { captureException, logger } from './observability'

const errorLogger = logger.child({ component: 'rest', subcomponent: 'error-handler' })

/**
 * Canonical API error envelope returned by all REST endpoints.
 *
 * ```json
 * { "error": { "message": "...", "code": "NOT_FOUND", "status": 404 } }
 * ```
 */
export type ApiErrorBody = {
  error: {
    message: string
    code: string
    status: number
    details?: unknown
  }
}

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
}

export function codeForStatus(status: number): string {
  return STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR')
}

function jsonError(c: Context, status: number, message: string, details?: unknown): Response {
  const body: ApiErrorBody = {
    error: { message, code: codeForStatus(status), status, ...(details ? { details } : {}) },
  }
  return c.json(body, status as never)
}

/**
 * Top-level Hono error handler. Produces a consistent JSON envelope, masks
 * internal details on 5xx in production, and reports server errors to Sentry.
 */
export const onError: ErrorHandler = (err, c) => {
  // Honor explicitly-constructed responses (e.g. the rate limiter's 429 with
  // Retry-After) so we don't drop headers callers set on purpose.
  if (err instanceof HTTPException) {
    if (err.res) return err.res
    return jsonError(c, err.status, err.message || codeForStatus(err.status))
  }

  if (err instanceof ZodError) {
    return jsonError(c, 400, 'Validation failed', err.issues)
  }

  // Unknown / unexpected error — treat as 500 and never leak internals in prod.
  errorLogger.error('Unhandled request error', err as Error, {
    path: c.req.path,
    method: c.req.method,
  })
  captureException(err)

  const message = isProduction()
    ? 'An unexpected error occurred. Please try again later.'
    : ((err as Error)?.message ?? 'Internal server error')

  return jsonError(c, 500, message)
}

/** Consistent 404 for unmatched routes. */
export const notFound: NotFoundHandler = (c) => {
  return jsonError(c, 404, `Route not found: ${c.req.method} ${c.req.path}`)
}
