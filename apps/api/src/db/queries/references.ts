import { type CslItem, makeCiteKey } from '@lemma/content/citations'
import { and, asc, eq, inArray } from 'drizzle-orm'

import type { DB } from '@api/db'
import { documentReferences, documents, type ReferenceItem, referenceItems } from '@api/db/schema'
import { generateId } from '@api/lib/utils'

export type LibraryItem = Pick<ReferenceItem, 'id' | 'key' | 'updatedAt'> & { csl: CslItem }

const toLibraryItem = (
  row: Pick<ReferenceItem, 'id' | 'key' | 'csl' | 'updatedAt'>
): LibraryItem => ({
  id: row.id,
  key: row.key,
  updatedAt: row.updatedAt,
  csl: { ...(row.csl as CslItem), id: row.id },
})

export async function listReferences(db: DB, userId: string): Promise<LibraryItem[]> {
  const rows = await db
    .select({
      id: referenceItems.id,
      key: referenceItems.key,
      csl: referenceItems.csl,
      updatedAt: referenceItems.updatedAt,
    })
    .from(referenceItems)
    .where(eq(referenceItems.userId, userId))
    .orderBy(asc(referenceItems.key))
  return rows.map(toLibraryItem)
}

const normalizeDoi = (doi: unknown) =>
  typeof doi === 'string' && doi.trim() ? doi.trim().toLowerCase() : null

const VALID_KEY = /^[A-Za-z0-9_][A-Za-z0-9_:.#$%&+?<>~/-]*$/

/**
 * Add items to the library. An item whose DOI is already in it isn't added
 * twice (the existing one is returned). Keys come from the source (a BibTeX
 * key) when free and valid, otherwise from the author, year and title.
 */
export async function addReferences(
  db: DB,
  userId: string,
  items: CslItem[]
): Promise<{ added: LibraryItem[]; existing: LibraryItem[] }> {
  const library = await listReferences(db, userId)
  const taken = new Set(library.map((item) => item.key))
  const byDoi = new Map(
    library.flatMap((item) => {
      const doi = normalizeDoi(item.csl.DOI)
      return doi ? [[doi, item] as const] : []
    })
  )
  const added: LibraryItem[] = []
  const existing: LibraryItem[] = []
  const now = new Date()
  const inserts = []
  for (const item of items) {
    const doi = normalizeDoi(item.DOI)
    const duplicate = doi ? byDoi.get(doi) : undefined
    if (duplicate) {
      existing.push(duplicate)
      continue
    }
    const sourceKey = typeof item.id === 'string' && VALID_KEY.test(item.id) ? item.id : null
    const key = sourceKey && !taken.has(sourceKey) ? sourceKey : makeCiteKey(item, taken)
    taken.add(key)
    const id = generateId()
    const { id: _sourceId, ...csl } = item
    inserts.push(
      db.insert(referenceItems).values({ id, userId, key, csl, createdAt: now, updatedAt: now })
    )
    const libraryItem = toLibraryItem({ id, key, csl, updatedAt: now })
    added.push(libraryItem)
    if (doi) byDoi.set(doi, libraryItem)
  }
  // D1 caps a batch's size; large imports go in slices.
  for (let i = 0; i < inserts.length; i += 50) {
    const slice = inserts.slice(i, i + 50)
    await db.batch(slice as [(typeof slice)[number], ...typeof slice])
  }
  return { added, existing }
}

export async function updateReference(
  db: DB,
  userId: string,
  id: string,
  update: { csl?: CslItem; key?: string }
): Promise<LibraryItem | undefined> {
  const values: Partial<typeof referenceItems.$inferInsert> = { updatedAt: new Date() }
  if (update.csl) {
    const { id: _id, ...csl } = update.csl
    values.csl = csl
  }
  if (update.key) values.key = update.key
  const [row] = await db
    .update(referenceItems)
    .set(values)
    .where(and(eq(referenceItems.id, id), eq(referenceItems.userId, userId)))
    .returning()
  return row ? toLibraryItem(row) : undefined
}

export async function deleteReferences(db: DB, userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const deleted = await db
    .delete(referenceItems)
    .where(and(eq(referenceItems.userId, userId), inArray(referenceItems.id, ids)))
    .returning({ id: referenceItems.id })
  return deleted.length
}

/** Published documents citing any of these references (to re-render them). */
export async function publishedDocumentsCiting(db: DB, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const rows = await db
    .selectDistinct({ id: documentReferences.documentId })
    .from(documentReferences)
    .innerJoin(documents, eq(documents.id, documentReferences.documentId))
    .where(and(inArray(documentReferences.referenceId, ids), eq(documents.status, 'PUBLISHED')))
  return rows.map((row) => row.id)
}
