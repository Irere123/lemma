import { chunkText } from '@lemma/content'
import { asc, eq, inArray } from 'drizzle-orm'

import type { DB } from '@api/db'
import { documentHtml, documentSearch } from '@api/db/schema'

// Derived bodies are split so no single D1 value approaches the 2 MB limit,
// whatever the document's length. 512K UTF-16 units is ≤ 1.5 MB as UTF-8.
const HTML_PART_CHARS = 512 * 1024
const SEARCH_PART_CHARS = 32_000

function split(text: string, size: number): string[] {
  if (text.length <= size) return [text]
  const parts: string[] = []
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size))
  return parts
}

/** Replace a document's published HTML; `null` removes it (unpublished/draft). */
export async function writePublishedHtml(db: DB, documentId: string, html: string | null) {
  const remove = db.delete(documentHtml).where(eq(documentHtml.documentId, documentId))
  if (html === null || html === '') {
    await remove
    return
  }
  const inserts = split(html, HTML_PART_CHARS).map((part, index) =>
    db.insert(documentHtml).values({ documentId, part: index, html: part })
  )
  await db.batch([remove, ...inserts])
}

export async function readPublishedHtml(db: DB, documentId: string): Promise<string | null> {
  const rows = await db
    .select({ html: documentHtml.html })
    .from(documentHtml)
    .where(eq(documentHtml.documentId, documentId))
    .orderBy(asc(documentHtml.part))
  return rows.length > 0 ? rows.map((row) => row.html).join('') : null
}

export async function writeSearchIndex(
  db: DB,
  input: {
    documentId: string
    userId: string | null
    title: string
    subtitle: string
    text: string
  }
) {
  const chunks = chunkText(input.text, SEARCH_PART_CHARS)
  if (chunks.length === 0) chunks.push('')
  const remove = db.delete(documentSearch).where(eq(documentSearch.documentId, input.documentId))
  const inserts = chunks.map((body, part) =>
    db.insert(documentSearch).values({
      documentId: input.documentId,
      userId: input.userId,
      part,
      // On every part, so a query can match title words and body words of any chunk.
      title: input.title,
      subtitle: input.subtitle,
      body,
    })
  )
  await db.batch([remove, ...inserts])
}

// Feed readers want full posts, but not a whole book per entry.
const FEED_HTML_MAX_CHARS = 200_000

/** Attach published HTML to feed items (omitted when too large for a feed). */
export async function withFeedHtml<T extends { id: string }>(
  db: DB,
  items: T[]
): Promise<(T & { html: string | null })[]> {
  if (items.length === 0) return []
  const rows = await db
    .select({ documentId: documentHtml.documentId, html: documentHtml.html })
    .from(documentHtml)
    .where(
      inArray(
        documentHtml.documentId,
        items.map((item) => item.id)
      )
    )
    .orderBy(asc(documentHtml.documentId), asc(documentHtml.part))
  const html = new Map<string, string>()
  for (const row of rows) html.set(row.documentId, (html.get(row.documentId) ?? '') + row.html)
  return items.map((item) => {
    const body = html.get(item.id) ?? null
    return { ...item, html: body && body.length <= FEED_HTML_MAX_CHARS ? body : null }
  })
}
