import { eq } from 'drizzle-orm'

import type { DB } from '@api/db'
import { user } from '@api/db/schema'

export async function getUserById(db: DB, id: string) {
  const [userDB] = await db.select().from(user).where(eq(user.id, id)).limit(1)
  return userDB
}
