import { useState } from 'react'

import { useRealtimeChannel } from '@/lib/realtime'

/**
 * Live view of a campaign's send + engagement. Mirrors the API's
 * `CampaignProgressSnapshot` (apps/api/src/realtime/types.ts) — keep in sync.
 */
export interface CampaignProgressSnapshot {
  campaignId: string | null
  status: 'idle' | 'sending' | 'sent' | 'failed'
  totalRecipients: number
  sentCount: number
  totalBatches: number
  batchesDone: number
  opens: number
  clicks: number
  unsubscribes: number
  startedAt: number | null
  completedAt: number | null
}

export function useCampaignRealtime(campaignId?: string): {
  snapshot: CampaignProgressSnapshot | null
  connected: boolean
} {
  const [snapshot, setSnapshot] = useState<CampaignProgressSnapshot | null>(null)

  const { connected } = useRealtimeChannel(
    campaignId ? `/realtime/campaigns/${campaignId}` : null,
    (message) => {
      if (message.type === 'campaign' && message.data) {
        setSnapshot(message.data as CampaignProgressSnapshot)
      }
    }
  )

  return { snapshot, connected }
}
