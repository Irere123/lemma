import type { MiddlewareHandler } from 'hono'

import { logger } from '@api/lib/observability'

const requestLogger = logger.child({ component: 'rest', subcomponent: 'request' })

/**
 * Request logging middleware that logs HTTP requests and responses
 */
export const requestLogging: MiddlewareHandler = async (c, next) => {
  const start = performance.now()
  const method = c.req.method
  const path = c.req.path
  const url = c.req.url

  try {
    await next()

    const duration = performance.now() - start
    const statusCode = c.res.status

    requestLogger.request(method, path, statusCode, duration, {
      url,
      userAgent: c.req.header('user-agent'),
    })
  } catch (error) {
    const duration = performance.now() - start
    requestLogger.error('Request failed', error as Error, {
      method,
      path,
      url,
      duration,
    })
    throw error
  }
}
