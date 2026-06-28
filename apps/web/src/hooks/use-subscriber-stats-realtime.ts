import { useRef, useState } from 'react'

import { useRealtimeChannel } from '@/lib/realtime'

/**
 * Live subscriber counts for the writer's dashboard. Mirrors the API's
 * `SubscriberStatsSnapshot` (apps/api/src/realtime/types.ts) — keep in sync.
 */
export interface SubscriberStatsSnapshot {
  total: number
  confirmed: number
  pending: number
  unsubscribed: number
}

export function useSubscriberStatsRealtime(
  onChange?: (stats: SubscriberStatsSnapshot) => void
): { stats: SubscriberStatsSnapshot | null; connected: boolean } {
  const [stats, setStats] = useState<SubscriberStatsSnapshot | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const { connected } = useRealtimeChannel('/realtime/subscribers', (message) => {
    if (message.type === 'subscribers' && message.data) {
      const next = message.data as SubscriberStatsSnapshot
      setStats(next)
      onChangeRef.current?.(next)
    }
  })

  return { stats, connected }
}
