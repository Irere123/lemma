import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'

import type { DB } from '@api/db'
import {
  type Campaign,
  type CampaignLink,
  campaignLinks,
  campaigns,
  clickEvents,
  subscribers,
  unsubscribeEvents,
} from '@api/db/schema'
import { generateId } from '@api/lib/utils'

// Campaign Types
export type CreateCampaignData = {
  title: string
  slug: string
  userId: string
  documentId?: string
  content?: string
  scheduledAt?: Date
  status?: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED'
}

export type UpdateCampaignData = {
  id: string
  title?: string
  content?: string
  scheduledAt?: Date
  status?: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED'
  sentAt?: Date
}

// Campaign CRUD
export const createCampaign = async (db: DB, data: CreateCampaignData): Promise<Campaign> => {
  const [campaign] = await db
    .insert(campaigns)
    .values({
      id: generateId('cmp'),
      title: data.title,
      slug: data.slug,
      userId: data.userId,
      documentId: data.documentId,
      content: data.content,
      scheduledAt: data.scheduledAt,
      status: data.status ?? 'DRAFT',
    })
    .returning()

  if (!campaign) {
    throw new Error('Failed to create campaign')
  }

  return campaign
}

export const updateCampaign = async (
  db: DB,
  data: UpdateCampaignData
): Promise<Campaign | undefined> => {
  const updateValues: any = {}
  if (data.title) updateValues.title = data.title
  if (data.content) updateValues.content = data.content
  if (Object.hasOwn(data, 'scheduledAt')) updateValues.scheduledAt = data.scheduledAt ?? null
  if (Object.hasOwn(data, 'status')) updateValues.status = data.status
  if (Object.hasOwn(data, 'sentAt')) updateValues.sentAt = data.sentAt ?? null
  updateValues.updatedAt = new Date()

  const [campaign] = await db
    .update(campaigns)
    .set(updateValues)
    .where(eq(campaigns.id, data.id))
    .returning()

  return campaign
}

export const getCampaignById = async (db: DB, id: string): Promise<Campaign | undefined> => {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1)

  return campaign
}

export const getCampaignsByUser = async (
  db: DB,
  userId: string,
  options?: { limit?: number; cursor?: string }
): Promise<Campaign[]> => {
  const limit = options?.limit || 20

  const query = db
    .select()
    .from(campaigns)
    .where(eq(campaigns.userId, userId))
    .orderBy(desc(campaigns.sentAt))
    .limit(limit)

  return query
}

export const deleteCampaign = async (db: DB, id: string): Promise<void> => {
  await db.delete(campaigns).where(eq(campaigns.id, id))
}

export const getDueScheduledCampaigns = async (
  db: DB,
  now: Date = new Date(),
  limit = 50
): Promise<Campaign[]> => {
  return db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.status, 'SCHEDULED'), lte(campaigns.scheduledAt, now)))
    .orderBy(campaigns.scheduledAt)
    .limit(limit)
}

// Campaign Links
export const createCampaignLink = async (
  db: DB,
  data: { campaignId: string; url: string; label?: string }
): Promise<CampaignLink> => {
  const [link] = await db
    .insert(campaignLinks)
    .values({
      id: generateId('lnk'),
      campaignId: data.campaignId,
      url: data.url,
      label: data.label,
    })
    .returning()

  if (!link) {
    throw new Error('Failed to create campaign link')
  }

  return link
}

export const getCampaignLinks = async (db: DB, campaignId: string): Promise<CampaignLink[]> => {
  return db.select().from(campaignLinks).where(eq(campaignLinks.campaignId, campaignId))
}

// Analytics Queries
export type CampaignStats = {
  campaignId: string
  totalSent: number
  totalClicks: number
  uniqueClicks: number
  totalUnsubscribes: number
  clickRate: number
  unsubscribeRate: number
}

export const getCampaignStats = async (db: DB, campaignId: string): Promise<CampaignStats> => {
  // Get total clicks
  const clicksResult = await db
    .select({
      total: sql<number>`count(*)`,
      unique: sql<number>`count(distinct ${clickEvents.subscriberId})`,
    })
    .from(clickEvents)
    .innerJoin(campaignLinks, eq(clickEvents.linkId, campaignLinks.id))
    .where(eq(campaignLinks.campaignId, campaignId))

  // Get unsubscribes
  const unsubsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(unsubscribeEvents)
    .where(eq(unsubscribeEvents.campaignId, campaignId))

  // Get campaign to find total sent (would need to track this)
  const campaign = await getCampaignById(db, campaignId)

  const totalClicks = clicksResult[0]?.total || 0
  const uniqueClicks = clicksResult[0]?.unique || 0
  const totalUnsubscribes = unsubsResult[0]?.count || 0

  // TODO: Track total sent in campaign table
  const totalSent = 0

  return {
    campaignId,
    totalSent,
    totalClicks,
    uniqueClicks,
    totalUnsubscribes,
    clickRate: totalSent > 0 ? (uniqueClicks / totalSent) * 100 : 0,
    unsubscribeRate: totalSent > 0 ? (totalUnsubscribes / totalSent) * 100 : 0,
  }
}

export const getClicksByLink = async (
  db: DB,
  campaignId: string
): Promise<Array<{ linkId: string; url: string; label: string | null; clicks: number }>> => {
  const results = await db
    .select({
      linkId: campaignLinks.id,
      url: campaignLinks.url,
      label: campaignLinks.label,
      clicks: sql<number>`count(${clickEvents.id})`,
    })
    .from(campaignLinks)
    .leftJoin(clickEvents, eq(clickEvents.linkId, campaignLinks.id))
    .where(eq(campaignLinks.campaignId, campaignId))
    .groupBy(campaignLinks.id)

  return results
}

export const getClicksOverTime = async (
  db: DB,
  campaignId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; clicks: number }>> => {
  const results = await db
    .select({
      date: sql<string>`date_trunc('hour', ${clickEvents.clickedAt})::text`,
      clicks: sql<number>`count(*)`,
    })
    .from(clickEvents)
    .innerJoin(campaignLinks, eq(clickEvents.linkId, campaignLinks.id))
    .where(
      and(
        eq(campaignLinks.campaignId, campaignId),
        gte(clickEvents.clickedAt, startDate),
        lte(clickEvents.clickedAt, endDate)
      )
    )
    .groupBy(sql`date_trunc('hour', ${clickEvents.clickedAt})`)
    .orderBy(sql`date_trunc('hour', ${clickEvents.clickedAt})`)

  return results
}

// Subscriber analytics
export const getSubscriberGrowth = async (
  db: DB,
  writerId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; newSubscribers: number; unsubscribes: number }>> => {
  const newSubs = await db
    .select({
      date: sql<string>`date_trunc('day', ${subscribers.subscribedAt})::text`,
      count: sql<number>`count(*)`,
    })
    .from(subscribers)
    .where(
      and(
        eq(subscribers.writerId, writerId),
        gte(subscribers.subscribedAt, startDate),
        lte(subscribers.subscribedAt, endDate)
      )
    )
    .groupBy(sql`date_trunc('day', ${subscribers.subscribedAt})`)

  const unsubs = await db
    .select({
      date: sql<string>`date_trunc('day', ${subscribers.unsubscribedAt})::text`,
      count: sql<number>`count(*)`,
    })
    .from(subscribers)
    .where(
      and(
        eq(subscribers.writerId, writerId),
        gte(subscribers.unsubscribedAt, startDate),
        lte(subscribers.unsubscribedAt, endDate)
      )
    )
    .groupBy(sql`date_trunc('day', ${subscribers.unsubscribedAt})`)

  // Merge results
  const dateMap = new Map<string, { newSubscribers: number; unsubscribes: number }>()

  for (const row of newSubs) {
    dateMap.set(row.date, { newSubscribers: row.count, unsubscribes: 0 })
  }

  for (const row of unsubs) {
    const existing = dateMap.get(row.date) || { newSubscribers: 0, unsubscribes: 0 }
    existing.unsubscribes = row.count
    dateMap.set(row.date, existing)
  }

  return Array.from(dateMap.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const getSubscriberStats = async (
  db: DB,
  writerId: string
): Promise<{
  total: number
  confirmed: number
  unsubscribed: number
  pending: number
}> => {
  const results = await db
    .select({
      total: sql<number>`count(*)`,
      confirmed: sql<number>`count(*) filter (where ${subscribers.isConfirmed} = true and ${subscribers.isUnsubscribed} = false)`,
      unsubscribed: sql<number>`count(*) filter (where ${subscribers.isUnsubscribed} = true)`,
      pending: sql<number>`count(*) filter (where ${subscribers.isConfirmed} = false and ${subscribers.isUnsubscribed} = false)`,
    })
    .from(subscribers)
    .where(eq(subscribers.writerId, writerId))

  return results[0] || { total: 0, confirmed: 0, unsubscribed: 0, pending: 0 }
}
