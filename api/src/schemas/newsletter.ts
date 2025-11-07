import { z } from "@hono/zod-openapi";

export const newsletterSettingsSchema = z.object({
  id: z.string().optional(),
  newsletterName: z.string().min(1, "Newsletter name is required"),
  fromName: z.string().min(1, "From name is required"),
  logoUrl: z.string().optional(),
  brandColor: z.string().optional(),
  isActive: z.boolean().default(true),
  confirmationUrl: z.string().optional(),
});
