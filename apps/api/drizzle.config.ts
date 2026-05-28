import type { Config } from 'drizzle-kit'

// Cloudflare D1 is SQLite under the hood. Migrations are generated here with
// drizzle-kit and applied to D1 via `wrangler d1 migrations apply`.
export default {
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
} satisfies Config
