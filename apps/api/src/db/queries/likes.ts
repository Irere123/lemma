import { and, eq, sql } from 'drizzle-orm'

import type { DB } from '@api/db'
import { documentLikes } from '@api/db/schema'
import { generateId } from '@api/lib/utils'

export const toggleLike = async (
  db: DB,
  documentId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number }> => {
  const existingLike = await db
    .select({ id: documentLikes.id })
    .from(documentLikes)
    .where(and(eq(documentLikes.documentId, documentId), eq(documentLikes.userId, userId)))
    .limit(1)

  if (existingLike.length > 0) {
    await db
      .delete(documentLikes)
      .where(and(eq(documentLikes.documentId, documentId), eq(documentLikes.userId, userId)))

    const likeCount = await getDocumentLikeCount(db, documentId)
    return { liked: false, likeCount }
  } else {
    await db.insert(documentLikes).values({
      id: generateId('like'),
      documentId,
      userId,
      createdAt: new Date(),
    })

    const likeCount = await getDocumentLikeCount(db, documentId)
    return { liked: true, likeCount }
  }
}

export const getLikeStatus = async (
  db: DB,
  documentId: string,
  userId: string
): Promise<{ isLiked: boolean; likeCount: number }> => {
  const [existingLike, likeCount] = await Promise.all([
    db
      .select({ id: documentLikes.id })
      .from(documentLikes)
      .where(and(eq(documentLikes.documentId, documentId), eq(documentLikes.userId, userId)))
      .limit(1),
    getDocumentLikeCount(db, documentId),
  ])

  return {
    isLiked: existingLike.length > 0,
    likeCount,
  }
}

export const getDocumentLikeCount = async (db: DB, documentId: string): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(documentLikes)
    .where(eq(documentLikes.documentId, documentId))

  return result[0]?.count ?? 0
}

export const hasUserLikedDocument = async (
  db: DB,
  documentId: string,
  userId: string
): Promise<boolean> => {
  const result = await db
    .select({ id: documentLikes.id })
    .from(documentLikes)
    .where(and(eq(documentLikes.documentId, documentId), eq(documentLikes.userId, userId)))
    .limit(1)

  return result.length > 0
}
