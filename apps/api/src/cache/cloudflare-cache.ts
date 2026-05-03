import { getRuntimeBindings } from '@api/env-runtime'

type MemoryEntry = {
  value: string
  expiresAt: number | null
}

const memoryCache = new Map<string, MemoryEntry>()

export class CloudflareCache {
  private prefix: string
  private defaultTTL: number

  constructor(prefix: string, defaultTTL: number = 30 * 60) {
    this.prefix = prefix
    this.defaultTTL = defaultTTL
  }

  private parseValue<T>(value: string | null): T | undefined {
    if (!value) return undefined

    try {
      return JSON.parse(value) as T
    } catch {
      return value as unknown as T
    }
  }

  private stringifyValue(value: unknown): string {
    if (typeof value === 'string') {
      return value
    }

    return JSON.stringify(value)
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`
  }

  async get<T>(key: string): Promise<T | undefined> {
    const cacheKey = this.getKey(key)

    try {
      const kv = getRuntimeBindings().CACHE
      if (kv) {
        return this.parseValue<T>(await kv.get(cacheKey, 'text'))
      }

      const entry = memoryCache.get(cacheKey)
      if (!entry) return undefined

      if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
        memoryCache.delete(cacheKey)
        return undefined
      }

      return this.parseValue<T>(entry.value)
    } catch (error) {
      console.error(`Cache get error for ${this.prefix} cache, key "${key}":`, error)
      return undefined
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const cacheKey = this.getKey(key)

    try {
      const serializedValue = this.stringifyValue(value)
      const ttl = ttlSeconds ?? this.defaultTTL
      const kv = getRuntimeBindings().CACHE

      if (kv) {
        await kv.put(cacheKey, serializedValue, ttl > 0 ? { expirationTtl: ttl } : undefined)
        return
      }

      memoryCache.set(cacheKey, {
        value: serializedValue,
        expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null,
      })
    } catch (error) {
      console.error(`Cache set error for ${this.prefix} cache, key "${key}":`, error)
    }
  }

  async delete(key: string): Promise<void> {
    const cacheKey = this.getKey(key)

    try {
      const kv = getRuntimeBindings().CACHE
      if (kv) {
        await kv.delete(cacheKey)
        return
      }

      memoryCache.delete(cacheKey)
    } catch (error) {
      console.error(`Cache delete error for ${this.prefix} cache, key "${key}":`, error)
    }
  }
}
