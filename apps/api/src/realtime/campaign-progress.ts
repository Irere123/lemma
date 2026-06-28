import { DurableObject } from 'cloudflare:workers'

import { createDb } from '@api/db'
import { markCampaignSent } from '@api/db/queries/campaigns'
import { type CloudflareBindings, setRuntimeEnv } from '@api/env-runtime'
import type { CampaignProgressSnapshot, EngagementKind } from './types'

/**
 * One Durable Object per campaign. It is the single coordination point for a
 * send: the email worker reports the total work up front, each batch reports
 * completion, and when every batch is in the DO flips the campaign to SENT in
 * D1 (the queue pipeline has no other place that knows "all batches finished").
 *
 * It also accumulates live engagement counters and fans every change out to the
 * dashboards connected over WebSocket (hibernation API, so idle costs nothing).
 */

interface StoredState extends CampaignProgressSnapshot {
  // Batch indices already counted, so retries/at-least-once delivery never
  // double-count `sentCount` or prematurely trip completion.
  completedBatches: number[]
}

const INITIAL_STATE: StoredState = {
  campaignId: null,
  status: 'idle',
  totalRecipients: 0,
  sentCount: 0,
  totalBatches: 0,
  batchesDone: 0,
  opens: 0,
  clicks: 0,
  unsubscribes: 0,
  startedAt: null,
  completedAt: null,
  completedBatches: [],
}

export class CampaignProgress extends DurableObject<CloudflareBindings> {
  private state: StoredState = { ...INITIAL_STATE }

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env)
    setRuntimeEnv(env)
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<StoredState>('state')
      if (saved) this.state = { ...INITIAL_STATE, ...saved }
    })
  }

  // --- RPC (called from the queue workers via the namespace binding) ---

  /** Initialise a send. Called once, before any batch is enqueued. */
  async start(input: {
    campaignId: string
    totalRecipients: number
    totalBatches: number
  }): Promise<void> {
    this.state.campaignId = input.campaignId
    this.state.totalRecipients = input.totalRecipients
    this.state.totalBatches = input.totalBatches
    this.state.sentCount = 0
    this.state.batchesDone = 0
    this.state.completedBatches = []
    this.state.opens = 0
    this.state.clicks = 0
    this.state.unsubscribes = 0
    this.state.status = 'sending'
    this.state.startedAt = Date.now()
    this.state.completedAt = null

    // A send with no recipients is already "done".
    if (input.totalBatches === 0) await this.finalize()

    await this.persistAndBroadcast()
  }

  /** Report a finished batch. Idempotent per `batchIndex`. */
  async batchCompleted(input: { batchIndex: number; count: number }): Promise<void> {
    if (this.state.completedBatches.includes(input.batchIndex)) return

    this.state.completedBatches.push(input.batchIndex)
    this.state.sentCount += input.count
    this.state.batchesDone = this.state.completedBatches.length

    if (
      this.state.status !== 'sent' &&
      this.state.totalBatches > 0 &&
      this.state.batchesDone >= this.state.totalBatches
    ) {
      await this.finalize()
    }

    await this.persistAndBroadcast()
  }

  /** Increment an engagement counter (opens / clicks / unsubscribes). */
  async recordEngagement(input: { kind: EngagementKind; count?: number }): Promise<void> {
    const n = input.count ?? 1
    if (input.kind === 'open') this.state.opens += n
    else if (input.kind === 'click') this.state.clicks += n
    else this.state.unsubscribes += n
    await this.persistAndBroadcast()
  }

  /** Current snapshot (HTTP/RPC fallback for when no socket is open). */
  async getSnapshot(): Promise<CampaignProgressSnapshot> {
    return this.toSnapshot()
  }

  // --- WebSocket (hibernation API) ---

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }

    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    server.send(JSON.stringify({ type: 'campaign', data: this.toSnapshot() }))

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

  private toSnapshot(): CampaignProgressSnapshot {
    const { completedBatches: _omit, ...snapshot } = this.state
    return snapshot
  }

  private async finalize(): Promise<void> {
    if (this.state.status === 'sent') return
    this.state.status = 'sent'
    this.state.completedAt = Date.now()

    if (!this.state.campaignId) return
    try {
      setRuntimeEnv(this.env)
      const { db } = createDb(this.env.DB)
      await markCampaignSent(db, this.state.campaignId, this.state.sentCount)
    } catch (error) {
      console.error('CampaignProgress: failed to mark campaign sent', {
        campaignId: this.state.campaignId,
        error: String(error),
      })
    }
  }

  private async persistAndBroadcast(): Promise<void> {
    await this.ctx.storage.put('state', this.state)
    const message = JSON.stringify({ type: 'campaign', data: this.toSnapshot() })
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message)
      } catch {
        // socket is gone; hibernation cleanup will reap it
      }
    }
  }
}
