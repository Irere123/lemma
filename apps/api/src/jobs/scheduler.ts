import { eq } from 'drizzle-orm'

import { createDb } from '@api/db'
import { getDueScheduledCampaigns, updateCampaign } from '@api/db/queries/campaigns'
import { getDueScheduledDocuments } from '@api/db/queries/documents'
import { documents } from '@api/db/schema'
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
      })
      .where(eq(documents.id, document.id))
  }

  schedulerLogger.info('Scheduled jobs scan complete', {
    campaignCount: campaigns.length,
    documentCount: dueDocuments.length,
  })
}
