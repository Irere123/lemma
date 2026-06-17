import DataLoader from 'dataloader'

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
 * Adapt a Map-returning batch query into a DataLoader batch function. DataLoader
 * requires results in the same order and length as the requested keys, so we map
 * each key through the result Map and fall back for any the query omitted.
 */
function fromMap<K, V>(
  batchFn: (keys: K[]) => Promise<Map<K, V>>,
  fallback: (key: K) => V
): (keys: readonly K[]) => Promise<V[]> {
  return async (keys) => {
    const result = await batchFn([...keys])
    return keys.map((key) => result.get(key) ?? fallback(key))
  }
}

// Batch within a single microtask without depending on `process`/`setImmediate`,
// which aren't available on Cloudflare Workers.
const batchScheduleFn = (callback: () => void) => queueMicrotask(callback)

export type GraphQLLoaders = {
  document: DataLoader<string, Document | null>
  campaignStats: DataLoader<string, CampaignStats>
  campaignLinkClicks: DataLoader<string, LinkClickStats[]>
  replyCount: DataLoader<string, number>
}

/** Build a fresh set of loaders for a single GraphQL request. */
export function createLoaders(db: DB): GraphQLLoaders {
  return {
    document: new DataLoader<string, Document | null>(
      fromMap(
        (ids) => getDocumentsByIds(db, ids) as Promise<Map<string, Document | null>>,
        () => null
      ),
      { batchScheduleFn }
    ),
    campaignStats: new DataLoader<string, CampaignStats>(
      fromMap(
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
      { batchScheduleFn }
    ),
    campaignLinkClicks: new DataLoader<string, LinkClickStats[]>(
      fromMap(
        (ids) => getClicksByLinkForCampaigns(db, ids),
        () => []
      ),
      { batchScheduleFn }
    ),
    replyCount: new DataLoader<string, number>(
      fromMap(
        (ids) => getReplyCountsByParentIds(db, ids),
        () => 0
      ),
      { batchScheduleFn }
    ),
  }
}
