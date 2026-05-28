import { z } from 'zod'

const EnvSchema = z.object({
  // generic stuff
  ENV: z.enum(['local', 'production']),
  ALLOWED_API_ORIGINS: z.string(),
  LEMMA_ENCRYPTION_KEY: z.string(),
  ADMIN_USER_ID: z.string(),

  // observability (optional)
  SENTRY_DSN: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),

  // cloudflare R2 Storage
  CLOUDFLARE_ACCOUNT_ID: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_BUCKET_URL: z.url(),
  R2_STORAGE_BASE_URL: z.url(),

  // resend
  RESEND_API_KEY: z.string(),
  RESEND_DOMAIN: z.string(),

  // auth providers
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),

  // better-auth
  BETTER_AUTH_SECRET: z.string(),
  BETTER_AUTH_URL: z.url(),
  BASE_URL: z.url(),
  FRONTEND_URL: z.url(),
})

export type Environment = z.infer<typeof EnvSchema>

export function parseEnv(data: any) {
  const { data: env, error, success } = EnvSchema.safeParse(data)

  if (!success) {
    throw new Error(`Invalid environment variables: ${JSON.stringify(error.format())}`)
  }

  return env
}
