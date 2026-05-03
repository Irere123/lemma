import { and, eq } from 'drizzle-orm'

import { createDb } from '@api/db'
import { getCampaignById, updateCampaign } from '@api/db/queries/campaigns'
import { documents } from '@api/db/schema'
import { logger } from '@api/lib/observability'
import { enqueueNewsletter } from '../producers'
import type {
  PublishScheduledDocumentJob,
  ScheduledJobData,
  SendScheduledNewsletterJob,
} from '../types'

const workerLogger = logger.child({ component: 'jobs', subcomponent: 'scheduled-worker' })

type JobContext = {
  id?: string
  attempts?: number
}

export async function processScheduledJob(
  data: ScheduledJobData,
  context: JobContext = {}
): Promise<void> {
  const { db } = createDb()
  const timer = workerLogger.time(`process-scheduled-job-${data.type}`, {
    jobId: context.id,
    jobType: data.type,
  })

  try {
    switch (data.type) {
      case 'publish-scheduled-document': {
        await processDocumentPublish(data, db)
        break
      }

      case 'send-scheduled-newsletter': {
        await processScheduledNewsletter(data, db)
        break
      }
    }
  } catch (error) {
    workerLogger.error('Scheduled job failed', error as Error, {
      jobId: context.id,
      jobType: data.type,
    })
    throw error
  } finally {
    timer()
  }
}

async function processDocumentPublish(data: PublishScheduledDocumentJob, db: any): Promise<void> {
  const { documentId } = data

  // Update document status to PUBLISHED
  const [updatedDocument] = await db
    .update(documents)
    .set({
      status: 'PUBLISHED',
      publishedDate: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(documents.id, documentId), eq(documents.status, 'DRAFT')))
    .returning()

  if (updatedDocument) {
    workerLogger.info('Document published successfully', { documentId })
  } else {
    workerLogger.info('Document publish skipped because it is missing or no longer draft', {
      documentId,
    })
  }
}

async function processScheduledNewsletter(
  data: SendScheduledNewsletterJob,
  db: any
): Promise<void> {
  const { campaignId, documentId, writerId } = data
  const campaign = await getCampaignById(db, campaignId)

  if (!campaign || campaign.status !== 'SCHEDULED') {
    workerLogger.info('Scheduled newsletter skipped because campaign is no longer scheduled', {
      campaignId,
      status: campaign?.status,
    })
    return
  }

  if (campaign.scheduledAt && new Date(campaign.scheduledAt) > new Date()) {
    workerLogger.info('Scheduled newsletter skipped because scheduled time has not arrived', {
      campaignId,
      scheduledAt: campaign.scheduledAt,
    })
    return
  }

  await updateCampaign(db, {
    id: campaignId,
    status: 'SENDING',
  })

  // Enqueue the newsletter for immediate sending
  await enqueueNewsletter({
    campaignId,
    documentId,
    writerId,
  })

  workerLogger.info('Scheduled newsletter triggered', { campaignId, documentId, writerId })
}
