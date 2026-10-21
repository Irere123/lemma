import {
  type ContentDoc,
  citationClusters,
  citedReferenceIds,
  documentLinks,
  type RenderedCitations,
} from '@lemma/content'
import {
  type CitationCluster,
  type CslItem,
  createCitationProcessor,
  STYLES,
  type StyleId,
} from '@lemma/content/citations'
import { and, eq, inArray } from 'drizzle-orm'

import type { DB } from '@api/db'
import { documents, referenceItems, user } from '@api/db/schema'
import { env } from '@api/env-runtime'

export const DEFAULT_CITATION_STYLE: StyleId = 'apa'

export function citationStyleOf(value: unknown): StyleId {
  return STYLES.some((style) => style.id === value) ? (value as StyleId) : DEFAULT_CITATION_STYLE
}

/** A writer's references by id, as CSL items whose `id` is the row id. */
export async function loadReferences(db: DB, userId: string, ids: string[]): Promise<CslItem[]> {
  if (ids.length === 0) return []
  const rows = await db
    .select({ id: referenceItems.id, csl: referenceItems.csl })
    .from(referenceItems)
    .where(and(eq(referenceItems.userId, userId), inArray(referenceItems.id, ids)))
  return rows.map((row) => ({ ...(row.csl as CslItem), id: row.id }))
}

/**
 * Format a document's citations with the writer's library: one entry per
 * citation node in reading order, plus the bibliography of what's cited.
 */
export async function citationsFor(
  db: DB,
  userId: string,
  content: ContentDoc | null | undefined,
  style: StyleId
): Promise<{ rendered?: RenderedCitations; referenceIds: string[] }> {
  const ids = citedReferenceIds(content)
  if (ids.length === 0) return { referenceIds: [] }
  const items = await loadReferences(db, userId, ids)
  // Stored labels are validated strings; the processor knows the CSL locator labels.
  const clusters = citationClusters(content) as CitationCluster[]
  const result = createCitationProcessor(style, items).process(clusters)
  return {
    rendered: {
      clusters: result.clusters,
      bibliography: result.bibliography,
      numeric: STYLES.find((entry) => entry.id === style)?.kind === 'numeric',
    },
    referenceIds: items.map((item) => item.id),
  }
}

export type DocumentLinkResolver = (link: {
  documentId: string
  blockId: string | null
  title: string
}) => { href: string; title: string } | null

/**
 * Where a link to one of the writer's own documents goes on a public page:
 * its post URL if it's published, otherwise nowhere (its title is shown as
 * text and its id never leaves the server).
 */
export async function documentLinkResolver(
  db: DB,
  userId: string,
  content: ContentDoc | null | undefined
): Promise<DocumentLinkResolver> {
  const ids = [...new Set(documentLinks(content).map((link) => link.documentId))]
  if (ids.length === 0) return () => null
  const rows = await db
    .select({
      id: documents.id,
      slug: documents.slug,
      title: documents.title,
      status: documents.status,
      username: user.username,
    })
    .from(documents)
    .innerJoin(user, eq(user.id, documents.userId))
    .where(and(eq(documents.userId, userId), inArray(documents.id, ids)))
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ({ documentId, blockId }) => {
    const row = byId.get(documentId)
    if (!row || row.status !== 'PUBLISHED' || !row.slug || !row.username) return null
    const anchor = blockId ? `#${blockId}` : ''
    return {
      href: `${env.FRONTEND_URL}/u/${row.username}/${row.slug}${anchor}`,
      title: row.title ?? '',
    }
  }
}
