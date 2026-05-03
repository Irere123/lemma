import { drizzle } from 'drizzle-orm/postgres-js'
import postgres, { type Sql } from 'postgres'

import { getDatabaseUrl } from '@api/env-runtime'
import * as schema from './schema'

const createDrizzle = (conn: Sql) => drizzle(conn, { schema })

let cached:
  | {
      url: string
      conn: Sql
      db: ReturnType<typeof createDrizzle>
    }
  | undefined

export const createDb = (url: string = getDatabaseUrl()) => {
  if (cached?.url === url) {
    return cached
  }

  const conn = postgres(url, {
    max: 5,
    prepare: false,
  })
  const db = createDrizzle(conn)
  cached = { db, conn, url }
  return cached
}

export type DB = ReturnType<typeof createDrizzle>
