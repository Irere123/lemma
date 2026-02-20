import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import process from 'node:process'
import postgres from 'postgres'

config()

const connectionString = process.env.DATABASE_URL ?? process.env.PROD_DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL (or fallback PROD_DATABASE_URL) is not set')
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
