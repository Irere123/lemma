import { and, desc, eq, lt, sql } from 'drizzle-orm'

import type { DB } from '@api/db'
import { follows, user } from '@api/db/schema'
import { generateId } from '@api/lib/utils'

export type FollowUserSummary = {
  id: string
  name: string
  username: string | null
  image: string | null
  bio: string | null
  createdAt: Date | null
}

/**
 * Follow a user. Idempotent — re-following is a no-op thanks to the
 * (followerId, followingId) unique constraint.
 */
export const followUser = async (db: DB, followerId: string, followingId: string) => {
  await db
    .insert(follows)
    .values({
      id: generateId('flw'),
      followerId,
      followingId,
    })
    .onConflictDoNothing({ target: [follows.followerId, follows.followingId] })
}

/**
 * Unfollow a user. Safe to call when no follow row exists.
 */
export const unfollowUser = async (db: DB, followerId: string, followingId: string) => {
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
}

export const getFollowerCount = async (db: DB, userId: string): Promise<number> => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followingId, userId))
  return row?.count ?? 0
}

export const getFollowingCount = async (db: DB, userId: string): Promise<number> => {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .where(eq(follows.followerId, userId))
  return row?.count ?? 0
}

/**
 * Whether `viewerId` follows `userId`. Returns false for anonymous viewers.
 */
export const isFollowing = async (
  db: DB,
  viewerId: string | undefined,
  userId: string
): Promise<boolean> => {
  if (!viewerId) return false
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, viewerId), eq(follows.followingId, userId)))
    .limit(1)
  return Boolean(row)
}

const PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

type PageOptions = { limit?: number; cursor?: string }

const summaryColumns = {
  id: user.id,
  name: user.name,
  username: user.username,
  image: user.image,
  bio: user.bio,
  createdAt: follows.createdAt,
}

/**
 * Users who follow `userId` (most recent first), cursor-paginated on follow time.
 */
export const getFollowers = async (
  db: DB,
  userId: string,
  options: PageOptions = {}
): Promise<{ users: FollowUserSummary[]; nextCursor: string | null }> => {
  const limit = Math.min(options.limit ?? PAGE_SIZE, MAX_PAGE_SIZE)
  const filters = [eq(follows.followingId, userId)]
  if (options.cursor) {
    filters.push(lt(follows.createdAt, new Date(options.cursor)))
  }

  const rows = await db
    .select(summaryColumns)
    .from(follows)
    .innerJoin(user, eq(follows.followerId, user.id))
    .where(and(...filters))
    .orderBy(desc(follows.createdAt))
    .limit(limit + 1)

  return paginate(rows, limit)
}

/**
 * Users that `userId` follows (most recent first), cursor-paginated on follow time.
 */
export const getFollowing = async (
  db: DB,
  userId: string,
  options: PageOptions = {}
): Promise<{ users: FollowUserSummary[]; nextCursor: string | null }> => {
  const limit = Math.min(options.limit ?? PAGE_SIZE, MAX_PAGE_SIZE)
  const filters = [eq(follows.followerId, userId)]
  if (options.cursor) {
    filters.push(lt(follows.createdAt, new Date(options.cursor)))
  }

  const rows = await db
    .select(summaryColumns)
    .from(follows)
    .innerJoin(user, eq(follows.followingId, user.id))
    .where(and(...filters))
    .orderBy(desc(follows.createdAt))
    .limit(limit + 1)

  return paginate(rows, limit)
}

function paginate(rows: FollowUserSummary[], limit: number) {
  let nextCursor: string | null = null
  if (rows.length > limit) {
    const next = rows.pop()
    nextCursor = next?.createdAt ? next.createdAt.toISOString() : null
  }
  return { users: rows, nextCursor }
}
