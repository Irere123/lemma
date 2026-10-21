/**
 * Revision history: when the room keeps a copy of a document, and which
 * copies it keeps.
 *
 * Captured:
 * - every REVISION_INTERVAL_MS of continuous writing,
 * - at the end of each writing session (REVISION_SESSION_IDLE_MS without edits),
 * - before any single edit that deletes LARGE_DELETE_CHARS or more,
 * - at publish, before a restore, and before a schema migration.
 *
 * Kept: everything from the last day; the last revision of each day for a
 * month; the last of each week after that; and every published version.
 */

export const REVISION_INTERVAL_MS = 10 * 60_000
export const REVISION_SESSION_IDLE_MS = 5 * 60_000
export const LARGE_DELETE_CHARS = 1_000
// A burst of large deletes keeps the state before the first one.
export const LARGE_DELETE_MIN_INTERVAL_MS = 60_000
export const MAX_REVISIONS = 500

export type RevisionReason =
  | 'auto'
  | 'before-large-edit'
  | 'publish'
  | 'before-restore'
  | 'before-migration'
  | 'before-replace'
  | 'before-split'
  | 'before-merge'

export type RevisionSummary = {
  id: number
  createdAt: number
  reason: RevisionReason
  words: number
  title: string
}

const DAY_MS = 24 * 60 * 60_000
const KEEP_ALL_MS = DAY_MS
const KEEP_DAILY_MS = 30 * DAY_MS

/** Ids of revisions the retention policy drops. */
export function revisionsToPrune(
  revisions: Pick<RevisionSummary, 'id' | 'createdAt' | 'reason'>[],
  now: number
): number[] {
  const newestFirst = [...revisions].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
  const keep = new Set<number>()
  const buckets = new Set<string>()
  for (const [index, revision] of newestFirst.entries()) {
    const age = now - revision.createdAt
    if (revision.reason === 'publish' || age < KEEP_ALL_MS) {
      keep.add(revision.id)
      continue
    }
    // Newest-first, so the first revision seen in a bucket is its last.
    const bucket =
      age < KEEP_DAILY_MS
        ? `d${Math.floor(revision.createdAt / DAY_MS)}`
        : `w${Math.floor(revision.createdAt / (7 * DAY_MS))}`
    if (index === 0 || !buckets.has(bucket)) {
      buckets.add(bucket)
      keep.add(revision.id)
    }
  }
  // Hard cap: drop the oldest unpublished ones beyond it.
  const kept = newestFirst.filter((revision) => keep.has(revision.id))
  let excess = kept.length - MAX_REVISIONS
  for (let i = kept.length - 1; i > 0 && excess > 0; i--) {
    const revision = kept[i] as (typeof kept)[number]
    if (revision.reason === 'publish') continue
    keep.delete(revision.id)
    excess--
  }
  return revisions.filter((revision) => !keep.has(revision.id)).map((revision) => revision.id)
}
