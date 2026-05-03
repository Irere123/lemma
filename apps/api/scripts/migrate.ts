import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import process from 'node:process'
import postgres from 'postgres'

config()

const TARGET_DATABASE_URLS = {
  local: 'LOCAL_DATABASE_URL',
  production: 'PRODUCTION_DATABASE_URL',
} as const

const targetEnv = process.env.ENV
const targetUrlName =
  targetEnv === 'local' || targetEnv === 'production' ? TARGET_DATABASE_URLS[targetEnv] : undefined
const connectionString =
  process.env.DATABASE_URL ?? (targetUrlName ? process.env[targetUrlName] : undefined)

if (!targetUrlName) {
  throw new Error('ENV must be "local" or "production"')
}

if (!connectionString) {
  throw new Error(`DATABASE_URL or ${targetUrlName} is not set`)
}

console.log('Connecting to:', connectionString.replace(/:[^:@]+@/, ':****@')) // Log sanitized connection string

const migrationClient = postgres(connectionString, { max: 1 })

async function main() {
  console.log('Running migrations....')

  try {
    const db = drizzle(migrationClient)
    await migrate(db, { migrationsFolder: './migrations' })
    console.log('Migrations completed!')
  } catch (error) {
    console.error('Migrations failed:', error)
    throw error
  } finally {
    await migrationClient.end()
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
