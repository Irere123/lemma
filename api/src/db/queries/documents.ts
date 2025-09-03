import { eq } from "drizzle-orm";

import type { DB } from "@api/db";
import {
  documents,
  type Document,
  type DocumentStatus,
  type DocumentType,
} from "@api/db/schema";
import { generateId } from "@api/lib/utils";
import type { UpsertDocumentData } from "@api/schemas";
import { env } from "cloudflare:workers";

export const upsertDocument = async (
  db: DB,
  data: UpsertDocumentData,
  userId: string
): Promise<Document | undefined> => {
  if (data.id) {
    const [document] = await db
      .update(documents)
      .set({ ...data })
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

export const getUserDocuments = async (
  db: DB,
  userId: string
): Promise<Document[]> => {
  const documents = await db.query.documents.findMany({
    where: (table, { eq }) => eq(table.userId, userId),
  });
  return documents;
};

export const getAdminPublishedArticles = async (
  db: DB
): Promise<Document[]> => {
  return db.query.documents.findMany({
    where: (table, { and, eq }) =>
      and(eq(table.status, "PUBLISHED"), eq(table.userId, env.ADMIN_USER_ID)),
  });
};

export const getDocumentById = async (db: DB, id: string) => {
  return db.query.documents.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });
};

export const getPublishedArticles = async (db: DB): Promise<Document[]> => {
  const publishedArticles = await db.query.documents.findMany({
    where: (table, { and, eq }) =>
      and(eq(table.status, "PUBLISHED"), eq(table.type, "ARTICLE")),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
  return publishedArticles;
};

export const getPublishedArticleBySlug = async (
  db: DB,
  slug: string
): Promise<Document | undefined> => {
  // For now, we'll use the document ID as slug. might have a separate slug field
  const article = await db.query.documents.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.id, slug),
        eq(table.status, "PUBLISHED"),
        eq(table.type, "ARTICLE")
      ),
  });
  return article;
};

// Filter by type and status

type GetDocumentsByTypeAndStatusData = {
  type: DocumentType;
  status: DocumentStatus;
};

export const getDocumentsByTypeAndStatus = async (
  db: DB,
  data: GetDocumentsByTypeAndStatusData
): Promise<Document[]> => {
  return db.query.documents.findMany({
    where: (table, { and, eq }) =>
      and(eq(table.type, data.type), eq(table.status, data.status)),
  });
};
