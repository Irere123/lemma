import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1'

import { getRuntimeBindings } from '@api/env-runtime'
import * as schema from './schema'

/**
 * Creates a Drizzle client backed by Cloudflare D1.
 *
 * The D1 binding is only available at runtime via the Worker's environment, so
 * by default we read it from the runtime bindings set in `setRuntimeEnv`. A
 * binding can also be passed explicitly (e.g. from a queue/scheduled handler).
 */
export const createDb = (d1?: D1Database) => {
  const binding = d1 ?? getRuntimeBindings().DB

  if (!binding) {
    throw new Error('D1 binding "DB" is not available in the current environment')
  }

  const db = drizzle(binding, { schema })
  return { db }
}

export type DB = DrizzleD1Database<typeof schema>
