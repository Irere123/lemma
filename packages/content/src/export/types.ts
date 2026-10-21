import type { ContentDoc } from '../types'

export type { ContentDoc }

/** One chapter document. Consecutive chapters with the same `part` are grouped under it. */
export type ExportChapter = { id: string; title: string; doc: ContentDoc; part?: string }

export type ExportImage = { data: Uint8Array; mediaType: string }

export type ExportBook = {
  title: string
  subtitle?: string
  author: string
  /** BCP-47; default 'en'. */
  language?: string
  /** Default `urn:uuid:<random>`. */
  identifier?: string
  publisher?: string
  /** ISO 8601. */
  date?: string
  description?: string
  cover?: ExportImage
  chapters: ExportChapter[]
}

/**
 * Loads an image so it can be embedded. Return null (or throw) to leave it out:
 * EPUB then keeps the remote URL, DOCX shows an "[Image: alt]" placeholder.
 */
export type FetchImage = (src: string) => Promise<ExportImage | null>
