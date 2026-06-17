import { and, eq, ne, sql } from 'drizzle-orm'

import type { DB } from '@api/db'
import { documents, user } from '@api/db/schema'
import { slugifyString } from '@api/db/utils/slugify'
import { getFollowerCount, getFollowingCount, isFollowing } from './follows'

export async function getUserById(db: DB, id: string) {
  const [userDB] = await db.select().from(user).where(eq(user.id, id)).limit(1)
  return userDB
}

export async function getUserByUsername(db: DB, username: string) {
  const [userDB] = await db.select().from(user).where(eq(user.username, username)).limit(1)
  return userDB
}

export type PublicProfile = {
  id: string
  name: string
  username: string | null
  image: string | null
  bio: string | null
  website: string | null
  location: string | null
  socialLinks: {
    twitter?: string
    github?: string
    linkedin?: string
    website?: string
  } | null
  createdAt: Date | null
  followerCount: number
  followingCount: number
  postCount: number
  isFollowing: boolean
}

/**
 * Resolve a public profile by handle, including follower/following/post counts
 * and whether the (optional) viewer already follows the author.
 */
export async function getPublicProfile(
  db: DB,
  username: string,
  viewerId?: string
): Promise<PublicProfile | undefined> {
  const userDB = await getUserByUsername(db, username)
  if (!userDB) return undefined

  const [followerCount, followingCount, postCount, viewerFollows] = await Promise.all([
    getFollowerCount(db, userDB.id),
    getFollowingCount(db, userDB.id),
    getPublishedPostCount(db, userDB.id),
    isFollowing(db, viewerId, userDB.id),
  ])

  return {
    id: userDB.id,
    name: userDB.name,
    username: userDB.username,
    image: userDB.image,
    bio: userDB.bio,
    website: userDB.website,
    location: userDB.location,
    socialLinks: userDB.socialLinks ?? null,
    createdAt: userDB.createdAt,
    followerCount,
    followingCount,
    postCount,
    isFollowing: viewerFollows,
  }
}

export async function getPublishedPostCount(db: DB, userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.status, 'PUBLISHED')))
  return row?.count ?? 0
}

/**
 * Whether `username` is free (optionally excluding the user already holding it).
 */
export async function isUsernameAvailable(
  db: DB,
  username: string,
  excludeUserId?: string
): Promise<boolean> {
  const where = excludeUserId
    ? and(eq(user.username, username), ne(user.id, excludeUserId))
    : eq(user.username, username)
  const [existing] = await db.select({ id: user.id }).from(user).where(where).limit(1)
  return !existing
}

/**
 * Derive a unique, slug-safe handle from a base string (name or email local
 * part), appending an incremental suffix on collision — mirrors how document
 * slugs dedupe in queries/documents.ts.
 */
export async function ensureUniqueUsername(db: DB, base: string): Promise<string> {
  const root = slugifyString(base).slice(0, 24) || 'user'
  let candidate = root
  let suffix = 0
  while (true) {
    if (await isUsernameAvailable(db, candidate)) return candidate
    suffix += 1
    candidate = `${root}-${suffix}`
  }
}

/**
 * Persist profile fields the user controls from settings. `username` uniqueness
 * is enforced by the DB unique index; callers should pre-check availability.
 */
export async function updateUserProfile(
  db: DB,
  userId: string,
  data: {
    username?: string
    bio?: string | null
    website?: string | null
    location?: string | null
    socialLinks?: PublicProfile['socialLinks']
  }
) {
  const [updated] = await db
    .update(user)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning()
  return updated
}
