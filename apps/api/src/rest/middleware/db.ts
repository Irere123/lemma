import type { MiddlewareHandler } from 'hono'

import { createDb } from '@api/db'
import { logger } from '@api/lib/observability'

const middlewareLogger = logger.child({ component: 'rest', subcomponent: 'middleware' })

/**
 * Database middleware that connects to the database and sets it on context
 */
export const withDatabase: MiddlewareHandler = async (c, next) => {
  const timer = middlewareLogger.time('database-connection')
  const { db } = createDb()

  // Set database on context
  c.set('db', db)

  try {
    await next()
  } catch (error) {
    middlewareLogger.error('Database middleware error', error as Error)
    throw error
  } finally {
    timer()
  }
}
