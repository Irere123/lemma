import type { ApiKey } from '@api/db/queries'
import { CloudflareCache } from './cloudflare-cache'

// Short TTL so a revoked/rotated key stops authenticating quickly even if an
// explicit cache invalidation is ever missed or lags across KV regions. The
// cache is still invalidated eagerly on update/delete (see the api-keys tRPC
// router); this TTL is the defense-in-depth upper bound on staleness.
const API_KEY_CACHE_TTL_SECONDS = 5 * 60

const cache = new CloudflareCache('api-key', API_KEY_CACHE_TTL_SECONDS)

export const apiKeyCache = {
  get: (key: string): Promise<ApiKey | undefined> => cache.get<ApiKey>(key),
  set: (key: string, value: ApiKey): Promise<void> => cache.set(key, value),
  delete: (key: string): Promise<void> => cache.delete(key),
}
