import { CloudflareCache } from './cloudflare-cache'

const cache = new CloudflareCache('user', 30 * 60)

export const userCache = {
  get: (key: string): Promise<any | undefined> => cache.get(key),
  set: (key: string, value: any): Promise<void> => cache.set(key, value),
  delete: (key: string): Promise<void> => cache.delete(key),
}
