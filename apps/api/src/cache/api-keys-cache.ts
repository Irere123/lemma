import type { ApiKey } from '@api/db/queries'
import { CloudflareCache } from './cloudflare-cache'

const cache = new CloudflareCache('api-key', 30 * 60)

export const apiKeyCache = {
  get: (key: string): Promise<ApiKey | undefined> => cache.get<ApiKey>(key),
  set: (key: string, value: ApiKey): Promise<void> => cache.set(key, value),
  delete: (key: string): Promise<void> => cache.delete(key),
}
