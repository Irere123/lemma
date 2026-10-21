import { parseDateString } from './dates'
import { cleanDoi } from './identifiers'
import { collapseWhitespace, isRecord, stripCslMarkup } from './util'

/**
 * A practical subset of CSL-JSON (https://citeproc-js.readthedocs.io/en/latest/csl-json/markup.html),
 * the interchange format used by Zotero, Pandoc and doi.org content negotiation.
 */

export type CslType =
  | 'article'
  | 'article-journal'
  | 'article-magazine'
  | 'article-newspaper'
  | 'bill'
  | 'book'
  | 'broadcast'
  | 'chapter'
  | 'dataset'
  | 'document'
  | 'entry'
  | 'entry-dictionary'
  | 'entry-encyclopedia'
  | 'figure'
  | 'graphic'
  | 'interview'
  | 'legal_case'
  | 'legislation'
  | 'manuscript'
  | 'map'
  | 'motion_picture'
  | 'musical_score'
  | 'pamphlet'
  | 'paper-conference'
  | 'patent'
  | 'personal_communication'
  | 'post'
  | 'post-weblog'
  | 'report'
  | 'review'
  | 'review-book'
  | 'software'
  | 'song'
  | 'speech'
  | 'standard'
  | 'thesis'
  | 'webpage'

export const CSL_TYPES: readonly CslType[] = [
  'article',
  'article-journal',
  'article-magazine',
  'article-newspaper',
  'bill',
  'book',
  'broadcast',
  'chapter',
  'dataset',
  'document',
  'entry',
  'entry-dictionary',
  'entry-encyclopedia',
  'figure',
  'graphic',
  'interview',
  'legal_case',
  'legislation',
  'manuscript',
  'map',
  'motion_picture',
  'musical_score',
  'pamphlet',
  'paper-conference',
  'patent',
  'personal_communication',
  'post',
  'post-weblog',
  'report',
  'review',
  'review-book',
  'software',
  'song',
  'speech',
  'standard',
  'thesis',
  'webpage',
]

export type CslName = {
  family?: string
  given?: string
  /** An institutional or single-field name, printed as is. */
  literal?: string
  'non-dropping-particle'?: string
  'dropping-particle'?: string
  suffix?: string
}

export type CslDate = {
  /** One `[year, month?, day?]` entry, or two for a range. */
  'date-parts'?: number[][]
  literal?: string
  raw?: string
}

export type CslItem = {
  id: string
  type: CslType
  title?: string
  'container-title'?: string
  'collection-title'?: string
  author?: CslName[]
  editor?: CslName[]
  translator?: CslName[]
  issued?: CslDate
  accessed?: CslDate
  volume?: string
  issue?: string
  page?: string
  'number-of-pages'?: string
  edition?: string
  publisher?: string
  'publisher-place'?: string
  DOI?: string
  URL?: string
  ISBN?: string
  ISSN?: string
  number?: string
  genre?: string
  'event-title'?: string
  abstract?: string
  note?: string
  language?: string
  archive?: string
  archive_location?: string
  medium?: string
}

/** What every parser returns: the items it could read and why it skipped the rest. */
export type ParseResult = { items: CslItem[]; warnings: string[] }

const STRING_FIELDS = [
  'title',
  'container-title',
  'collection-title',
  'volume',
  'issue',
  'page',
  'number-of-pages',
  'edition',
  'publisher',
  'publisher-place',
  'DOI',
  'URL',
  'ISBN',
  'ISSN',
  'number',
  'genre',
  'event-title',
  'abstract',
  'note',
  'language',
  'archive',
  'archive_location',
  'medium',
] as const

const TITLE_FIELDS = new Set<string>([
  'title',
  'container-title',
  'collection-title',
  'event-title',
])
const NAME_FIELDS = ['author', 'editor', 'translator'] as const
const DATE_FIELDS = ['issued', 'accessed'] as const

const KNOWN_TYPES = new Set<string>(CSL_TYPES)

// Type names used by Crossref, DataCite and older CSL processors.
const TYPE_ALIASES: Record<string, CslType> = {
  'journal-article': 'article-journal',
  journal_article: 'article-journal',
  'book-chapter': 'chapter',
  'book-section': 'chapter',
  'book-part': 'chapter',
  'reference-entry': 'entry-encyclopedia',
  'proceedings-article': 'paper-conference',
  'posted-content': 'article',
  preprint: 'article',
  'edited-book': 'book',
  monograph: 'book',
  'reference-book': 'book',
  dissertation: 'thesis',
  'report-component': 'report',
  'web-page': 'webpage',
  website: 'webpage',
  blog: 'post-weblog',
  'blog-post': 'post-weblog',
  'journal-issue': 'article-journal',
  film: 'motion_picture',
  'computer-program': 'software',
  data: 'dataset',
}

export function normalizeType(value: unknown): CslType {
  if (typeof value !== 'string') return 'document'
  const type = value.trim()
  if (KNOWN_TYPES.has(type)) return type as CslType
  const lower = type.toLowerCase()
  if (KNOWN_TYPES.has(lower)) return lower as CslType
  return TYPE_ALIASES[lower] ?? 'document'
}

/** A trimmed, single-line string from a string, number or the first item of an array. */
function coerceString(value: unknown, multiline = false): string | undefined {
  if (Array.isArray(value)) return coerceString(value[0], multiline)
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return undefined
  const text = multiline ? value.trim() : collapseWhitespace(value)
  return text || undefined
}

function normalizeName(raw: unknown): CslName | null {
  if (typeof raw === 'string') {
    const literal = collapseWhitespace(raw)
    return literal ? { literal } : null
  }
  if (!isRecord(raw)) return null
  const name: CslName = {}
  for (const key of [
    'family',
    'given',
    'literal',
    'non-dropping-particle',
    'dropping-particle',
    'suffix',
  ] as const) {
    const value = coerceString(raw[key])
    if (value) name[key] = value
  }
  // Some exporters use `name` for single-field names.
  if (!name.family && !name.literal) {
    const single = coerceString(raw.name)
    if (single) name.literal = single
  }
  if (!name.family && !name.literal) {
    // A lone given name is a mononym; keep it printable.
    return name.given ? { literal: name.given } : null
  }
  return name
}

function normalizeNames(raw: unknown): CslName[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const names = raw.map(normalizeName).filter((n): n is CslName => n !== null)
  return names.length ? names : undefined
}

function normalizeDate(raw: unknown): CslDate | undefined {
  if (typeof raw === 'string' || typeof raw === 'number') return parseDateString(String(raw))
  if (!isRecord(raw)) return undefined
  const date: CslDate = {}
  const parts = raw['date-parts']
  if (Array.isArray(parts)) {
    const ranges: number[][] = []
    for (const part of parts.slice(0, 2)) {
      if (!Array.isArray(part)) continue
      const numbers: number[] = []
      for (const n of part.slice(0, 3)) {
        const value = typeof n === 'number' ? n : Number.parseInt(String(n), 10)
        if (!Number.isFinite(value)) break
        numbers.push(value)
      }
      if (numbers.length) ranges.push(numbers)
    }
    if (ranges.length) date['date-parts'] = ranges
  }
  const literal = coerceString(raw.literal)
  if (literal) date.literal = literal
  const rawText = coerceString(raw.raw)
  if (rawText) {
    date.raw = rawText
    if (!date['date-parts'] && !date.literal) {
      const parsed = parseDateString(rawText)
      if (parsed?.['date-parts']) date['date-parts'] = parsed['date-parts']
      else if (parsed?.literal) date.literal = parsed.literal
    }
  }
  return date['date-parts'] || date.literal || date.raw ? date : undefined
}

/**
 * Coerce untrusted CSL-JSON (from a file or an API) into a clean `CslItem`:
 * strings and numbers become trimmed strings, arrays collapse to their first
 * value, names and dates are validated, and every field outside the subset
 * above (Crossref's `reference`, `license`, `link`, …) is dropped.
 * A missing id is returned as '' for the caller to fill in.
 */
export function normalizeItem(raw: unknown): CslItem {
  const source = isRecord(raw) ? raw : {}
  const item: CslItem = {
    id: coerceString(source.id) ?? '',
    type: normalizeType(source.type),
  }
  for (const field of STRING_FIELDS) {
    const value = coerceString(source[field], field === 'abstract' || field === 'note')
    if (!value) continue
    if (field === 'DOI') {
      const doi = cleanDoi(value)
      if (doi) item.DOI = doi
    } else if (TITLE_FIELDS.has(field)) {
      // We render plain text, so CSL's <i>/<sup>/<span class="nocase"> are dropped.
      const title = stripCslMarkup(value)
      if (title) item[field] = title
    } else {
      item[field] = value
    }
  }
  for (const field of NAME_FIELDS) {
    const names = normalizeNames(source[field])
    if (names) item[field] = names
  }
  for (const field of DATE_FIELDS) {
    const date = normalizeDate(source[field])
    if (date) item[field] = date
  }
  return item
}
