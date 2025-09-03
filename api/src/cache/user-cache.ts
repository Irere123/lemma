import { env } from "cloudflare:workers";

export const userCache = {
  get: (key: string): Promise<any | null> => env.CACHE_KV.get(`user:${key}`),
  set: (key: string, value: any): Promise<void> =>
    env.CACHE_KV.put(`user:${key}`, JSON.stringify(value), {
      expirationTtl: 30 * 60, // 30 minutes
    }),
  delete: (key: string): Promise<void> => env.CACHE_KV.delete(`user:${key}`),
};
