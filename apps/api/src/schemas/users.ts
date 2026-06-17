import { z } from '@hono/zod-openapi'

export const userProfileSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .openapi('UserProfile')

// Handle: lowercase letters, numbers, hyphen, underscore; 3–30 chars.
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Handle must be at least 3 characters.')
  .max(30, 'Handle must be at most 30 characters.')
  .regex(/^[a-z0-9_-]+$/, 'Use only lowercase letters, numbers, hyphens, or underscores.')

export const socialLinksSchema = z.object({
  twitter: z.string().trim().max(200).optional(),
  github: z.string().trim().max(200).optional(),
  linkedin: z.string().trim().max(200).optional(),
  website: z.string().trim().max(200).optional(),
})

export const getProfileByUsernameSchema = z.object({
  username: usernameSchema,
})

export const checkUsernameSchema = z.object({
  username: usernameSchema,
})

export const updateSocialLinksSchema = z.object({
  socialLinks: socialLinksSchema,
})

export const profilePostsSchema = z.object({
  username: usernameSchema,
  sort: z.enum(['latest', 'popular']).default('latest'),
  limit: z.number().int().min(1).max(50).optional(),
})

export type SocialLinks = z.infer<typeof socialLinksSchema>
