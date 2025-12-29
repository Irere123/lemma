import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm'

import type { DB } from '@api/db'
import { comments, user } from '@api/db/schema'
import { generateId } from '@api/lib/utils'
import type { CreateCommentData, GetCommentsData, CommentWithAuthor } from '@api/schemas'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

// ============================================================================
// CREATE OPERATIONS
// ============================================================================

export const createComment = async (
  db: DB,
  data: CreateCommentData,
  userId: string
) => {
  const [comment] = await db
    .insert(comments)
    .values({
      id: generateId('cmt'),
      documentId: data.documentId,
      userId,
      parentId: data.parentId ?? null,
      content: data.content,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()

  if (!comment) {
    throw new Error('Failed to create comment')
  }

  return comment
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

export const getCommentById = async (db: DB, id: string) => {
  return db.query.comments.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  })
}

export const getCommentWithAuthor = async (
  db: DB,
  id: string
): Promise<CommentWithAuthor | undefined> => {
  const result = await db
    .select({
      id: comments.id,
      documentId: comments.documentId,
      userId: comments.userId,
      parentId: comments.parentId,
      content: comments.content,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      author: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(comments)
    .innerJoin(user, eq(comments.userId, user.id))
    .where(eq(comments.id, id))
    .limit(1)

  return result[0]
}

export const getDocumentComments = async (
  db: DB,
  data: GetCommentsData
): Promise<CommentWithAuthor[]> => {
  const limit = Math.min(data.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

  const filters = [eq(comments.documentId, data.documentId)]

  // Filter by parentId (null for top-level comments)
  if (data.parentId) {
    filters.push(eq(comments.parentId, data.parentId))
  } else {
    filters.push(isNull(comments.parentId))
  }

  // Cursor-based pagination
  if (data.cursor) {
    filters.push(lt(comments.createdAt, new Date(data.cursor)))
  }

  const results = await db
    .select({
      id: comments.id,
      documentId: comments.documentId,
      userId: comments.userId,
      parentId: comments.parentId,
      content: comments.content,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      author: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(comments)
    .innerJoin(user, eq(comments.userId, user.id))
    .where(and(...filters))
    .orderBy(desc(comments.createdAt))
    .limit(limit + 1) // Fetch one extra for pagination

  return results
}

export const getCommentReplies = async (
  db: DB,
  commentId: string,
  options?: { limit?: number; cursor?: string }
): Promise<CommentWithAuthor[]> => {
  const limit = Math.min(options?.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

  const filters = [eq(comments.parentId, commentId)]

  if (options?.cursor) {
    filters.push(lt(comments.createdAt, new Date(options.cursor)))
  }

  const results = await db
    .select({
      id: comments.id,
      documentId: comments.documentId,
      userId: comments.userId,
      parentId: comments.parentId,
      content: comments.content,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      author: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(comments)
    .innerJoin(user, eq(comments.userId, user.id))
    .where(and(...filters))
    .orderBy(desc(comments.createdAt))
    .limit(limit + 1)

  return results
}

export const getReplyCount = async (db: DB, commentId: string): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(eq(comments.parentId, commentId))

  return result[0]?.count ?? 0
}

export const getDocumentCommentCount = async (db: DB, documentId: string): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(eq(comments.documentId, documentId))

  return result[0]?.count ?? 0
}

// ============================================================================
// UPDATE OPERATIONS
// ============================================================================

export const updateComment = async (
  db: DB,
  id: string,
  userId: string,
  content: string
) => {
  const [comment] = await db
    .update(comments)
    .set({ content, updatedAt: new Date() })
    .where(and(eq(comments.id, id), eq(comments.userId, userId)))
    .returning()

  return comment
}

// ============================================================================
// DELETE OPERATIONS
// ============================================================================

export const deleteComment = async (db: DB, id: string, userId: string): Promise<boolean> => {
  const result = await db
    .delete(comments)
    .where(and(eq(comments.id, id), eq(comments.userId, userId)))
    .returning({ id: comments.id })

  return result.length > 0
}
