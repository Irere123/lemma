import { and, eq, sql } from 'drizzle-orm'
import { GraphQLError } from 'graphql'

import {
  deleteDocument,
  getDocumentById,
  getPublishedArticleBySlug,
  getPublishedArticles,
  getUserDocuments,
  updateDocumentBannerImage,
  upsertDocument,
} from '@api/db/queries'
import { documents, type Document, type DocumentStatus } from '@api/db/schema'
import type { GraphQLContext } from '../context'
import { requireAuth, requireScope } from '../context'
import {
  buildConnection,
  decodeCursor,
  getLimit,
  type Connection,
  type ConnectionArgs,
} from '../pagination'

type DocumentFilterInput = {
  status?: DocumentStatus
}

type PaginationInput = ConnectionArgs

type CreateDocumentInput = {
  title?: string | null
  subtitle?: string | null
  status?: DocumentStatus | null
  content?: any
  markdown?: string | null
  bannerImage?: string | null
  scheduledDate?: Date | null
  publishedDate?: Date | null
}

type UpdateDocumentInput = {
  id: string
  title?: string | null
  subtitle?: string | null
  status?: DocumentStatus | null
  content?: any
  markdown?: string | null
  bannerImage?: string | null
  scheduledDate?: Date | null
  publishedDate?: Date | null
}

async function getDocumentsTotalCount(
  db: any,
  userId: string,
  status?: DocumentStatus
): Promise<number> {
  const filters = [eq(documents.userId, userId)]
  if (status) {
    filters.push(eq(documents.status, status))
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(and(...filters))

  return result[0]?.count ?? 0
}

export const documentResolvers = {
  Query: {
    documents: async (
      _: unknown,
      args: { filter?: DocumentFilterInput; pagination?: PaginationInput },
      context: GraphQLContext
    ): Promise<Connection<Document>> => {
      requireAuth(context)
      requireScope(context, 'documents.read')

      const { db, session } = context
      const userId = session!.user.id
      const limit = getLimit(args.pagination ?? {})
      const cursor = args.pagination?.after ? decodeCursor(args.pagination.after) : undefined

      const userDocuments = await getUserDocuments(db, {
        userId,
        status: args.filter?.status,
        limit: limit + 1, // Fetch one extra to check for next page
        cursor,
      })

      const totalCount = await getDocumentsTotalCount(db, userId, args.filter?.status)

      return buildConnection(
        userDocuments as Document[],
        args.pagination ?? {},
        totalCount,
        (doc) => doc.createdAt?.toISOString() ?? doc.id
      )
    },

    document: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext
    ): Promise<Document | null> => {
      requireAuth(context)
      requireScope(context, 'documents.read')

      const doc = await getDocumentById(context.db, args.id)
      if (!doc) return null

      // Ensure user owns the document
      if (doc.userId !== context.session!.user.id) {
        throw new GraphQLError('Not authorized to access this document', {
          extensions: { code: 'FORBIDDEN' },
        })
      }

      return doc
    },

    // Public queries for posts
    post: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext
    ): Promise<Document | null> => {
      const doc = await getDocumentById(context.db, args.id)
      if (!doc || doc.status !== 'PUBLISHED') return null
      return doc
    },

    postBySlug: async (
      _: unknown,
      args: { slug: string },
      context: GraphQLContext
    ): Promise<Document | null> => {
      const doc = await getPublishedArticleBySlug(context.db, args.slug)
      return doc ?? null
    },

    publishedPosts: async (
      _: unknown,
      args: { first?: number },
      context: GraphQLContext
    ): Promise<Document[]> => {
      const limit = Math.min(args.first ?? 20, 100)
      return getPublishedArticles(context.db, limit) as Promise<Document[]>
    },

    node: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
      // Try to find document first
      const doc = await getDocumentById(context.db, args.id)
      if (doc) {
        return { ...doc, __typename: 'Document' }
      }
      return null
    },
  },

  Mutation: {
    createDocument: async (
      _: unknown,
      args: { input: CreateDocumentInput },
      context: GraphQLContext
    ): Promise<Document> => {
      requireAuth(context)
      requireScope(context, 'documents.write')

      const { db, session } = context
      const input = {
        ...args.input,
        status: args.input.status ?? ('DRAFT' as const),
      }
      const doc = await upsertDocument(db, input, session!.user.id)

      if (!doc) {
        throw new GraphQLError('Failed to create document', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        })
      }

      return doc
    },

    updateDocument: async (
      _: unknown,
      args: { input: UpdateDocumentInput },
      context: GraphQLContext
    ): Promise<Document> => {
      requireAuth(context)
      requireScope(context, 'documents.write')

      const { db, session } = context

      // Check ownership
      const existing = await getDocumentById(db, args.input.id)
      if (!existing || existing.userId !== session!.user.id) {
        throw new GraphQLError('Document not found or not authorized', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      const input = {
        ...args.input,
        status: args.input.status ?? existing.status ?? ('DRAFT' as const),
      }
      const doc = await upsertDocument(db, input, session!.user.id)

      if (!doc) {
        throw new GraphQLError('Failed to update document', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        })
      }

      return doc
    },

    deleteDocument: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext
    ): Promise<boolean> => {
      requireAuth(context)
      requireScope(context, 'documents.write')

      const { db, session } = context

      // Check ownership
      const existing = await getDocumentById(db, args.id)
      if (!existing || existing.userId !== session!.user.id) {
        throw new GraphQLError('Document not found or not authorized', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      await deleteDocument(db, args.id)
      return true
    },

    updateDocumentBanner: async (
      _: unknown,
      args: { id: string; bannerImage: string },
      context: GraphQLContext
    ): Promise<Document> => {
      requireAuth(context)
      requireScope(context, 'documents.write')

      const { db, session } = context

      const doc = await updateDocumentBannerImage(db, args.id, session!.user.id, args.bannerImage)

      if (!doc) {
        throw new GraphQLError('Document not found or not authorized', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      return doc
    },
  },

  Document: {
    // Field resolvers can be added here if needed
  },
}
