import { and, eq } from 'drizzle-orm'

import type { DB } from '@api/db'
import { apiKeys } from '@api/db/schema'
import { generateApiKey } from '@api/db/utils/api-keys'
import { encrypt, hash } from '@api/lib/encryption'
import { generateId } from '@api/lib/utils'

export type ApiKey = {
  id: string
  name: string
  userId: string
  createdAt: string
  scopes: string[] | null
}

export async function getApiKeyByToken(db: DB, keyHash: string) {
  const [result] = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      userId: apiKeys.userId,
      createdAt: apiKeys.createdAt,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1)
  return result
}

type UpsertApiKeyData = {
  id?: string
  name: string
  userId: string
  scopes: string[]
}

export async function upsertApiKey(db: DB, data: UpsertApiKeyData) {
  if (data.id) {
    const [result] = await db
      .update(apiKeys)
      .set({ name: data.name, scopes: data.scopes })
      .where(and(eq(apiKeys.id, data.id), eq(apiKeys.userId, data.userId)))
      .returning({ keyHash: apiKeys.keyHash })

    // On update we don't return the key, but return keyHash for cache invalidation
    return {
      key: null,
      keyHash: result?.keyHash,
    }
  }

  const key = generateApiKey()
  const keyEncrypted = encrypt(key)
  const keyHash = hash(key)

  const [result] = await db
    .insert(apiKeys)
    .values({
      id: generateId(),
      keyEncrypted,
      keyHash,
      name: data.name,
      userId: data.userId,
      scopes: data.scopes,
    })
    .returning({
      id: apiKeys.id,
      name: apiKeys.name,
      createdAt: apiKeys.createdAt,
    })

  return {
    key,
    data: result,
  }
}

export async function getApiKeysByUser(db: DB, userId: string) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      createdAt: apiKeys.createdAt,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(apiKeys.createdAt)
}

type DeleteApiKeyParams = {
  id: string
  userId: string
}

export async function deleteApiKey(db: DB, params: DeleteApiKeyParams) {
  const [result] = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, params.id), eq(apiKeys.userId, params.userId)))
    .returning({ keyHash: apiKeys.keyHash })

  // Return keyHash for cache invalidation by calling code
  return result?.keyHash
}

export async function updatedApiKeyLastUsedAt(db: DB, id: string) {
  return await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(apiKeys.id, id))
}
