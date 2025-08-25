import { eq } from "drizzle-orm";

import type { DB } from "@api/db";
import { documents, type Document } from "@api/db/schema";
import { generateId } from "@api/lib/utils";
import type { UpsertDocumentData } from "@api/schemas";

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
