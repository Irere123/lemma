import type { DB } from '@api/db'
import {
  type CampaignStats,
  getCampaignStatsByIds,
  getClicksByLinkForCampaigns,
} from '@api/db/queries/campaigns'
import { getReplyCountsByParentIds } from '@api/db/queries/comments'
import { getDocumentsByIds } from '@api/db/queries/documents'
import type { Document } from '@api/db/schema'

type LinkClickStats = { linkId: string; url: string; label: string | null; clicks: number }

/**
 * Minimal per-request batching loader (a small DataLoader): coalesces the keys
 * requested within a microtask into a single batch query and memoizes results
 * for the lifetime of the request. Uses `queueMicrotask` for Workers
 * compatibility (no `process`/`setImmediate` dependency).
 */
export function createBatchLoader<K extends string, V>(
  batchFn: (keys: K[]) => Promise<Map<K, V>>,
  fallback: (key: K) => V
): (key: K) => Promise<V> {
  const cache = new Map<K, Promise<V>>()
  let batch: { key: K; resolve: (value: V) => void; reject: (error: unknown) => void }[] = []
  let scheduled = false

  const flush = () => {
    scheduled = false
    const current = batch
    batch = []
    const keys = [...new Set(current.map((item) => item.key))]

    batchFn(keys)
      .then((result) => {
        for (const item of current) {
          item.resolve(result.get(item.key) ?? fallback(item.key))
        }
      })
      .catch((error) => {
        for (const item of current) item.reject(error)
      })
  }

  return (key: K): Promise<V> => {
    const cached = cache.get(key)
    if (cached) return cached

    const promise = new Promise<V>((resolve, reject) => {
      batch.push({ key, resolve, reject })
    })
    cache.set(key, promise)

    if (!scheduled) {
      scheduled = true
      queueMicrotask(flush)
    }

    return promise
  }
}

export type GraphQLLoaders = {
  document: (id: string) => Promise<Document | null>
  campaignStats: (campaignId: string) => Promise<CampaignStats>
  campaignLinkClicks: (campaignId: string) => Promise<LinkClickStats[]>
  replyCount: (parentId: string) => Promise<number>
}

/** Build a fresh set of loaders for a single GraphQL request. */
export function createLoaders(db: DB): GraphQLLoaders {
  return {
    document: createBatchLoader<string, Document | null>(
      (ids) => getDocumentsByIds(db, ids) as Promise<Map<string, Document | null>>,
      () => null
    ),
    campaignStats: createBatchLoader<string, CampaignStats>(
      (ids) => getCampaignStatsByIds(db, ids),
      (campaignId) => ({
        campaignId,
        totalSent: 0,
        totalClicks: 0,
        uniqueClicks: 0,
        totalUnsubscribes: 0,
        clickRate: 0,
        unsubscribeRate: 0,
      })
    ),
    campaignLinkClicks: createBatchLoader<string, LinkClickStats[]>(
      (ids) => getClicksByLinkForCampaigns(db, ids),
      () => []
    ),
    replyCount: createBatchLoader<string, number>(
      (ids) => getReplyCountsByParentIds(db, ids),
      () => 0
    ),
  }
}
