import { config } from 'dotenv'
import process from 'node:process'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, isNull } from 'drizzle-orm'
import slugify from 'slugify'

import { documents } from '../src/db/schema'

config()

const isProd = process.env.NODE_ENV === 'production'
const connectionString = isProd ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(`${isProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} is not set`)
}

async function ensureUniqueSlug(db: ReturnType<typeof drizzle>, base: string) {
  let candidate = base || 'post'
  let suffix = 0
  while (true) {
    const check = await db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.slug, candidate))
      .limit(1)
    if (check.length === 0) return candidate
    suffix += 1
    candidate = `${base}-${suffix}`
  }
}

async function main() {
  const client = postgres(connectionString as string, { max: 1 })
  const db = drizzle(client)

  console.log('Seeding slugs for documents without one...')

  const rows = await db
    .select({ id: documents.id, title: documents.title })
    .from(documents)
    .where(isNull(documents.slug))

  console.log(`Found ${rows.length} documents to update`)

  for (const row of rows) {
    const base = slugify(row.title ?? row.id, { lower: true, strict: true })
    const uniqueSlug = await ensureUniqueSlug(db, base)

    await db
      .update(documents)
      .set({ slug: uniqueSlug, updatedAt: new Date() })
      .where(eq(documents.id, row.id))

    console.log(`Updated ${row.id} -> ${uniqueSlug}`)
  }

  await client.end()
  console.log('Slug seeding complete')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
