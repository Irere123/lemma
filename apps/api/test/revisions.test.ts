import { describe, expect, test } from 'bun:test'

import { MAX_REVISIONS, revisionsToPrune } from '../src/lib/documents/revisions'

const HOUR = 60 * 60_000
const DAY = 24 * HOUR
const now = Date.UTC(2026, 9, 20, 12)

const revision = (id: number, ageMs: number, reason: 'auto' | 'publish' = 'auto') => ({
  id,
  createdAt: now - ageMs,
  reason,
})

describe('revision retention', () => {
  test('keeps everything from the last day', () => {
    const revisions = Array.from({ length: 30 }, (_, i) => revision(i + 1, i * 10 * 60_000))
    expect(revisionsToPrune(revisions, now)).toEqual([])
  })

  test('keeps the last revision of each day for a month', () => {
    // Three revisions on each of the days 2–4 ago.
    const revisions = [2, 3, 4].flatMap((days, d) =>
      [1, 2, 3].map((h, i) => revision(d * 10 + i + 1, days * DAY + h * HOUR))
    )
    const pruned = new Set(revisionsToPrune(revisions, now))
    const kept = revisions.filter((r) => !pruned.has(r.id))
    const days = new Set(kept.map((r) => Math.floor(r.createdAt / DAY)))
    expect(days.size).toBe(kept.length) // one per day
    // ...and it's the newest one of its day.
    for (const r of kept) {
      const day = Math.floor(r.createdAt / DAY)
      const sameDay = revisions.filter((o) => Math.floor(o.createdAt / DAY) === day)
      expect(r.createdAt).toBe(Math.max(...sameDay.map((o) => o.createdAt)))
    }
  })

  test('thins to one a week after a month, but never drops a published version', () => {
    const revisions = Array.from({ length: 60 }, (_, i) => revision(i + 1, (40 + i) * DAY))
    revisions.push(revision(100, 80 * DAY + HOUR, 'publish'))
    const pruned = new Set(revisionsToPrune(revisions, now))
    expect(pruned.has(100)).toBe(false)
    const kept = revisions.filter((r) => !pruned.has(r.id) && r.reason === 'auto')
    expect(kept.length).toBeGreaterThanOrEqual(8)
    expect(kept.length).toBeLessThanOrEqual(10)
  })

  test('always keeps the newest revision, and caps the total', () => {
    const old = [revision(1, 400 * DAY)]
    expect(revisionsToPrune(old, now)).toEqual([])
    const many = Array.from({ length: MAX_REVISIONS + 50 }, (_, i) => revision(i + 1, i * 60_000))
    expect(revisionsToPrune(many, now)).toHaveLength(50)
  })
})
