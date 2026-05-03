import { drizzle } from 'drizzle-orm/postgres-js'
import postgres, { type Sql } from 'postgres'

import { getDatabaseUrl } from '@api/env-runtime'
import * as schema from './schema'

const createDrizzle = (conn: Sql) => drizzle(conn, { schema })

export const createDb = (url: string = getDatabaseUrl()) => {
  const conn = postgres(url, {
    max: 5,
    prepare: false,
  })
  const db = createDrizzle(conn)
  return { db, conn, url }
}

export type DB = ReturnType<typeof createDrizzle>
