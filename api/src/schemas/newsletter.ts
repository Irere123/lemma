import { z } from "@hono/zod-openapi";

export const newsletterSettingsSchema = z.object({
  id: z.string().optional(),
  newsletterName: z.string().min(1, "Newsletter name is required"),
  fromName: z.string().min(1, "From name is required"),
  logoUrl: z.string().url().optional().or(z.literal("")),
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Valid hex color is required"),
  isActive: z.boolean().default(true),
});
