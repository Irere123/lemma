import { env } from "cloudflare:workers";
import type { ApiKey } from "@api/db/queries";

export const apiKeyCache = {
  get: (key: string): Promise<string | null> =>
    env.CACHE_KV.get<string>(`api-keys:${key}`),
  set: (key: string, value: ApiKey): Promise<void> =>
    env.CACHE_KV.put(`api-keys:${key}`, JSON.stringify(value), {
      expirationTtl: 30 * 60, // 30 minutes
    }),
  delete: (key: string): Promise<void> =>
    env.CACHE_KV.delete(`api-keys:${key}`),
};
