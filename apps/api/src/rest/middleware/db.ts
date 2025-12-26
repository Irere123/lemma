import type { MiddlewareHandler } from 'hono'

import { createDb } from '@api/db'
import { env } from '@api/env-runtime'
import { logger } from '@api/lib/observability'
import { withDatabaseSpan } from '@api/lib/observability/tracing'

const middlewareLogger = logger.child({ component: 'rest', subcomponent: 'middleware' })

/**
 * Database middleware that connects to the database and sets it on context
 */
export const withDatabase: MiddlewareHandler = async (c, next) => {
  return withDatabaseSpan('connect', 'database', async (span) => {
    const timer = middlewareLogger.time('database-connection')
    const { db } = createDb(env.DATABASE_URL)

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
  })
}
