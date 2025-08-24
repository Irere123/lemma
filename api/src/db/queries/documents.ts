import { eq } from "drizzle-orm";

import type { DB } from "@api/db";
import {
  documents,
  type Document,
  type DocumentStatus,
  type DocumentType,
} from "@api/db/schema";
import { generateId } from "@api/lib/utils";

export type UpsertDocumentData = {
  id?: string;
  title: string;
  subtitle: string;
  content?: any;
  type?: DocumentType;
  status?: DocumentStatus;
};

export const upsertDocument = async (
  db: DB,
  data: UpsertDocumentData
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
      .values({ ...data, id: generateId(), type: "ARTICLE", status: "DRAFT" })
      .returning();
    return document;
  } catch (error) {
    console.log(error);
  }
};

export const deleteDocument = async (db: DB, documentId: string) => {
  await db.delete(documents).where(eq(documents.id, documentId));
};
