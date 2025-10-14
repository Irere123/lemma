import { eq } from "drizzle-orm";
import type { DB } from "@api/db";
import { newsletterSettings, type NewsletterSettings } from "@api/db/schema";
import { generateId } from "@api/lib/utils";

type UpsertWriterNewsletterSettings = {
  id?: string;
  writerId: string;
  newsletterName: string;
  fromName: string;
  logoUrl: string | null;
  brandColor: string;
};

export const getWriterNewsletterSettings = async (
  db: DB,
  writerId: string
): Promise<NewsletterSettings | undefined> => {
  const [settings] = await db
    .select()
    .from(newsletterSettings)
    .where(eq(newsletterSettings.writerId, writerId))
    .limit(1);

  return settings;
};

export const upsertWriterNewsletterSettings = async (
  db: DB,
  settings: UpsertWriterNewsletterSettings
): Promise<NewsletterSettings | undefined> => {
  if (settings.id) {
    const [result] = await db
      .update(newsletterSettings)
      .set(settings)
      .where(eq(newsletterSettings.id, settings.id))
      .returning();

    return result;
  }

  const [result] = await db
    .insert(newsletterSettings)
    .values({
      ...settings,
      id: generateId(),
    })
    .returning();

  return result;
};

export const getActiveWriterNewsletterSettings = async (
  db: DB
): Promise<NewsletterSettings[]> => {
  const settings = await db
    .select()
    .from(newsletterSettings)
    .where(eq(newsletterSettings.isActive, true));

  return settings;
};
