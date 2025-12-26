import type { MiddlewareHandler } from 'hono'

import { createDb } from '@api/db'
import { env } from '@api/env-runtime'

/**
 * Database middleware that connects to the database and sets it on context
 */
export const withDatabase: MiddlewareHandler = async (c, next) => {
  const { db } = createDb(env.DATABASE_URL)

  // Set database on context
  c.set('db', db)

  await next()
}
