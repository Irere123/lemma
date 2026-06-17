import type { MiddlewareHandler } from 'hono'
import { withAuth } from './auth'
import { withDatabase } from './db'
import { requestLogging } from './request-logging'

/**
 * Public endpoint middleware - only attaches database with smart routing
 * No authentication required
 */
export const publicMiddleware: MiddlewareHandler[] = [requestLogging, withDatabase]

/**
 * Protected endpoint middleware - requires authentication
 * Includes database and authentication
 * Note: withAuth must be first to set session data in context
 */
export const protectedMiddleware: MiddlewareHandler[] = [requestLogging, withDatabase, withAuth]

export { withRequiredScope } from './scope'
export { apiRateLimit, authRateLimit, withRateLimit } from './rate-limit'
