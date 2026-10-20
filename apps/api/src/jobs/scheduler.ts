import { eq, isNull, sql } from 'drizzle-orm'

import { createDb } from '@api/db'
import { getDueScheduledCampaigns, updateCampaign } from '@api/db/queries/campaigns'
import { getDueScheduledDocuments } from '@api/db/queries/documents'
import { documents } from '@api/db/schema'
import { openRoom } from '@api/lib/documents/room'
import { logger } from '@api/lib/observability'
import { enqueueNewsletter } from './producers'

const schedulerLogger = logger.child({ component: 'jobs', subcomponent: 'scheduled-worker' })

export async function processDueScheduledJobs(now = new Date()) {
  const { db } = createDb()
  const campaigns = await getDueScheduledCampaigns(db, now)
  const dueDocuments = await getDueScheduledDocuments(db, now)

  for (const campaign of campaigns) {
    if (!campaign.documentId) {
      schedulerLogger.warn('Scheduled campaign skipped because it has no document', {
        campaignId: campaign.id,
      })
      continue
    }

    await updateCampaign(db, {
      id: campaign.id,
      status: 'SENDING',
    })

    await enqueueNewsletter({
      campaignId: campaign.id,
      documentId: campaign.documentId,
      writerId: campaign.userId,
    })
  }

  for (const document of dueDocuments) {
    await db
      .update(documents)
      .set({
        status: 'PUBLISHED',
        publishedDate: now,
        updatedAt: now,
        firstPublishedAt: sql`COALESCE(${documents.firstPublishedAt}, ${Math.floor(now.getTime() / 1000)})`,
      })
      .where(eq(documents.id, document.id))
    // Render the published page now rather than at the next edit, and keep
    // the published version in the document's history.
    await (await openRoom(document.id)).flushNow({ revision: 'publish' })
  }

  const migrated = await migrateLegacyDocuments(db)

  schedulerLogger.info('Scheduled jobs scan complete', {
    campaignCount: campaigns.length,
    documentCount: dueDocuments.length,
    migratedDocuments: migrated,
  })
}

const MIGRATE_PER_RUN = 25

/**
 * Move documents that predate DocumentRoom into their rooms a batch at a
 * time, so every post is re-rendered and re-indexed by the current pipeline
 * without waiting for someone to open it.
 */
async function migrateLegacyDocuments(db: ReturnType<typeof createDb>['db']): Promise<number> {
  const pending = await db
    .select({ id: documents.id })
    .from(documents)
    .where(isNull(documents.bodyStore))
    .limit(MIGRATE_PER_RUN)

  let migrated = 0
  for (const { id } of pending) {
    try {
      await (await openRoom(id)).flushNow()
      migrated += 1
    } catch (error) {
      schedulerLogger.error('Legacy document migration failed', error as Error, { documentId: id })
    }
  }
  return migrated
}
