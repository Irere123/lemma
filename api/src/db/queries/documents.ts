import { and, desc, eq, lt, asc } from "drizzle-orm";

import type { DB } from "@api/db";
import { documents, type Document, type DocumentStatus } from "@api/db/schema";
import { generateId } from "@api/lib/utils";
import type { UpsertDocumentData } from "@api/schemas";
import { env } from "cloudflare:workers";

// Default page size for pagination
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const upsertDocument = async (
  db: DB,
  data: UpsertDocumentData,
  userId: string
): Promise<Document | undefined> => {
  if (data.id) {
    const [document] = await db
      .update(documents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documents.id, data.id))
      .returning();
    return document;
  }

  try {
    const [document] = await db
      .insert(documents)
      .values({
        ...data,
        id: generateId(),
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return document;
  } catch (error) {
    console.log(error);
  }
};

export const deleteDocument = async (
  db: DB,
  documentId: string
): Promise<void> => {
  await db.delete(documents).where(eq(documents.id, documentId));
};

type UserDocumentsData = {
  userId: string;
  status?: DocumentStatus;
  limit?: number;
  cursor?: string;
};

export const getUserDocuments = async (
  db: DB,
  data: UserDocumentsData
): Promise<Omit<Document, "content" | "markdown">[]> => {
  const limit = Math.min(data.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

  // Build filter conditions dynamically
  const filters = [eq(documents.userId, data.userId)];

  if (data.status) {
    filters.push(eq(documents.status, data.status));
  }

  // Add cursor-based pagination
  if (data.cursor) {
    filters.push(lt(documents.createdAt, new Date(data.cursor)));
  }

  // Execute query with all applicable filters
  // Exclude heavy fields (content, markdown) from list queries
  const userDocuments = await db
    .select({
      id: documents.id,
      title: documents.title,
      subtitle: documents.subtitle,
      status: documents.status,
      userId: documents.userId,
      bannerImage: documents.bannerImage,
      scheduledDate: documents.scheduledDate,
      publishedDate: documents.publishedDate,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(and(...filters))
    .orderBy(desc(documents.createdAt))
    .limit(limit + 1); // Fetch one extra to determine if there's a next page

  return userDocuments;
};

export const getAdminPublishedArticles = async (
  db: DB,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<Omit<Document, "content" | "markdown">[]> => {
  const safeLimit = Math.min(limit, MAX_PAGE_SIZE);

  const results = await db
    .select({
      id: documents.id,
      title: documents.title,
      subtitle: documents.subtitle,
      status: documents.status,
      userId: documents.userId,
      bannerImage: documents.bannerImage,
      scheduledDate: documents.scheduledDate,
      publishedDate: documents.publishedDate,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(
      and(
        eq(documents.status, "PUBLISHED"),
        eq(documents.userId, env.ADMIN_USER_ID)
      )
    )
    .orderBy(asc(documents.publishedDate), asc(documents.createdAt))
    .limit(safeLimit);

  return results;
};

export const getDocumentById = async (db: DB, id: string) => {
  return db.query.documents.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });
};

export const getPublishedArticles = async (
  db: DB,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<Omit<Document, "content" | "markdown">[]> => {
  const safeLimit = Math.min(limit, MAX_PAGE_SIZE);

  const publishedArticles = await db
    .select({
      id: documents.id,
      title: documents.title,
      subtitle: documents.subtitle,
      status: documents.status,
      userId: documents.userId,
      bannerImage: documents.bannerImage,
      scheduledDate: documents.scheduledDate,
      publishedDate: documents.publishedDate,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(and(eq(documents.status, "PUBLISHED")))
    .orderBy(desc(documents.publishedDate), desc(documents.createdAt))
    .limit(safeLimit);

  return publishedArticles;
};

export const getPublishedArticleBySlug = async (
  db: DB,
  slug: string
): Promise<Document | undefined> => {
  // For now, we'll use the document ID as slug. might have a separate slug field
  const article = await db.query.documents.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.id, slug), eq(table.status, "PUBLISHED")),
  });
  return article;
};

// Filter by type and status

type GetDocumentsByTypeAndStatusData = {
  status: DocumentStatus;
};

export const getDocumentsByTypeAndStatus = async (
  db: DB,
  data: GetDocumentsByTypeAndStatusData,
  limit: number = DEFAULT_PAGE_SIZE
): Promise<Omit<Document, "content" | "markdown">[]> => {
  const safeLimit = Math.min(limit, MAX_PAGE_SIZE);

  const results = await db
    .select({
      id: documents.id,
      title: documents.title,
      subtitle: documents.subtitle,
      status: documents.status,
      userId: documents.userId,
      bannerImage: documents.bannerImage,
      scheduledDate: documents.scheduledDate,
      publishedDate: documents.publishedDate,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(and(eq(documents.status, data.status)))
    .orderBy(desc(documents.createdAt))
    .limit(safeLimit);

  return results;
};
