import { DurableObject } from 'cloudflare:workers'

import { createDb } from '@api/db'
import { getSubscriberStats } from '@api/db/queries/campaigns'
import { type CloudflareBindings, setRuntimeEnv } from '@api/env-runtime'
import type { SubscriberStatsSnapshot } from './types'

/**
 * One Durable Object per writer. Subscriber lifecycle changes (subscribe,
 * confirm, unsubscribe, add, remove) ping it; it re-reads the authoritative
 * counts from D1 and fans them out to the writer's open dashboards. Reading
 * from D1 on each (infrequent) change keeps the numbers drift-free without the
 * DO having to mirror subscriber state.
 */
export class WriterStats extends DurableObject<CloudflareBindings> {
  private writerId: string | null = null

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env)
    setRuntimeEnv(env)
    ctx.blockConcurrencyWhile(async () => {
      this.writerId = (await ctx.storage.get<string>('writerId')) ?? null
    })
  }

  // --- RPC ---

  /** Remember which writer this DO represents (DOs don't know their own name). */
  async ensure(writerId: string): Promise<void> {
    await this.rememberWriter(writerId)
  }

  /** A subscriber lifecycle change happened — push fresh counts to dashboards. */
  async notifyChange(writerId: string): Promise<void> {
    await this.rememberWriter(writerId)
    if (this.ctx.getWebSockets().length === 0) return
    await this.broadcast(await this.readStats())
  }

  // --- WebSocket (hibernation API) ---

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }

    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)

    if (this.writerId) {
      try {
        server.send(JSON.stringify({ type: 'subscribers', data: await this.readStats() }))
      } catch (error) {
        console.error('WriterStats: failed to send initial stats', { error: String(error) })
      }
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return
    try {
      if (JSON.parse(message)?.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }))
    } catch {
      // ignore malformed frames
    }
  }

  // --- internals ---

  private async rememberWriter(writerId: string): Promise<void> {
    if (this.writerId === writerId) return
    this.writerId = writerId
    await this.ctx.storage.put('writerId', writerId)
  }

  private async readStats(): Promise<SubscriberStatsSnapshot> {
    setRuntimeEnv(this.env)
    const { db } = createDb(this.env.DB)
    const stats = await getSubscriberStats(db, this.writerId as string)
    return {
      total: stats.total,
      confirmed: stats.confirmed,
      pending: stats.pending,
      unsubscribed: stats.unsubscribed,
    }
  }

  private async broadcast(stats: SubscriberStatsSnapshot): Promise<void> {
    const message = JSON.stringify({ type: 'subscribers', data: stats })
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message)
      } catch {
        // socket is gone; hibernation cleanup will reap it
      }
    }
  }
}
