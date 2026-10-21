import type { CslDate, CslItem, CslName, CslType } from './csl'
import type { Rich } from './rich'
import { sortableText } from './util'

// Types and helpers shared by the four citation styles.

export type StyleId = 'apa' | 'chicago' | 'ieee' | 'nature'

export type LocatorLabel =
  | 'page'
  | 'chapter'
  | 'section'
  | 'figure'
  | 'paragraph'
  | 'line'
  | 'volume'

export type CitationItemRef = {
  id: string
  locator?: string
  label?: LocatorLabel
  prefix?: string
  suffix?: string
}

export type CitationCluster = {
  items: CitationItemRef[]
  mode?: 'normal' | 'suppress-author' | 'author-in-text'
}

export type AuthorDateStyle = {
  kind: 'author-date'
  /** Names for an in-text citation ("Smith & Jones"), or null when there are none. */
  citeNames(item: CslItem, narrative: boolean, withInitials: boolean): string | null
  /** The title used in place of missing names, and whether it is quoted (else italic). */
  citeTitle(item: CslItem): { title: string; quoted: boolean }
  /** Between names and year: ", " in APA, " " in Chicago. */
  yearDelimiter: string
  locator(ref: CitationItemRef): string
  entry(item: CslItem, yearLabel: string): Rich
  /** Sort key for the names part of a bibliography entry. */
  sortNames(item: CslItem): string
  /** APA lists n.d. works before dated ones by the same author; Chicago after. */
  undatedFirst: boolean
  /** Whether multi-item clusters are reordered to match the reference list. */
  sortCitations: boolean
}

export type NumericStyle = {
  kind: 'numeric'
  citeNames(item: CslItem): string | null
  locator(ref: CitationItemRef): string
  entry(item: CslItem): Rich
  /** "[1] " or "1. " in front of a bibliography entry. */
  label(n: number): string
  superscript: boolean
}

export type Style = AuthorDateStyle | NumericStyle

// ---------------------------------------------------------------------------
// Item classification

export type Kind =
  | 'periodical'
  | 'part'
  | 'thesis'
  | 'report'
  | 'webpage'
  | 'preprint'
  | 'book'
  | 'other'

const KIND: Partial<Record<CslType, Kind>> = {
  'article-journal': 'periodical',
  'article-magazine': 'periodical',
  'article-newspaper': 'periodical',
  review: 'periodical',
  'review-book': 'periodical',
  'post-weblog': 'periodical',
  chapter: 'part',
  'paper-conference': 'part',
  entry: 'part',
  'entry-dictionary': 'part',
  'entry-encyclopedia': 'part',
  thesis: 'thesis',
  report: 'report',
  webpage: 'webpage',
  post: 'webpage',
  article: 'preprint',
  book: 'book',
  pamphlet: 'book',
}

export function kindOf(item: CslItem): Kind {
  return KIND[item.type] ?? 'other'
}

/** Types dated to the day in APA and Chicago (news, magazines, web content). */
export function datedToTheDay(item: CslItem): boolean {
  return ['article-newspaper', 'article-magazine', 'webpage', 'post', 'post-weblog'].includes(
    item.type
  )
}

// ---------------------------------------------------------------------------
// Dates

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// IEEE Reference Guide abbreviations (note "Sept.").
export const MONTHS_IEEE = [
  'Jan.',
  'Feb.',
  'Mar.',
  'Apr.',
  'May',
  'Jun.',
  'Jul.',
  'Aug.',
  'Sept.',
  'Oct.',
  'Nov.',
  'Dec.',
]

export type DateBits = { year?: number; month?: number; day?: number; literal?: string }

export function dateBits(date: CslDate | undefined): DateBits {
  const parts = date?.['date-parts']?.[0]
  if (parts?.[0]) {
    const [year, month, day] = parts
    return {
      year,
      month: month && month >= 1 && month <= 12 ? month : undefined,
      day: month && day && day >= 1 && day <= 31 ? day : undefined,
    }
  }
  const literal = date?.literal ?? date?.raw
  return literal ? { literal } : {}
}

/** "March 15, 2020" / "March 2020" / "2020". */
export function longDate(date: CslDate | undefined): string {
  const { year, month, day, literal } = dateBits(date)
  if (!year) return literal ?? ''
  if (!month) return String(year)
  return day ? `${MONTHS[month - 1]} ${day}, ${year}` : `${MONTHS[month - 1]} ${year}`
}

// ---------------------------------------------------------------------------
// Names

/** Family name with its particle ("van der Berg"), or the literal name. */
export function familyName(name: CslName): string {
  if (name.literal) return name.literal
  return [name['non-dropping-particle'], name.family].filter(Boolean).join(' ')
}

const GIVEN_PARTICLES = new Set([
  'de',
  'da',
  'das',
  'do',
  'dos',
  'del',
  'della',
  'der',
  'den',
  'di',
  'du',
  'la',
  'le',
  'los',
  'las',
  'van',
  'von',
  'y',
])

/** "John Ronald Reuel" → "J. R. R.", "Jean-Paul" → "J.-P.", "JR" (PubMed style) → "J. R.". */
export function initials(given: string): string {
  const value = given.trim()
  if (!value) return ''
  // Run-together capitals with no periods are already initials (PubMed's "JR").
  if (/^[A-Z]{2,3}$/.test(value)) return `${value.split('').join('. ')}.`
  return value
    .replace(/\.-/g, '-')
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((word) => {
      // Particles inside a given name ("Maria de los Angeles") stay as they are.
      if (GIVEN_PARTICLES.has(word)) return word
      return word
        .split('-')
        .filter(Boolean)
        .map((part) => `${Array.from(part)[0]!.toUpperCase()}.`)
        .join('-')
    })
    .join(' ')
}

/** "Smith, J. A." (APA, Nature). */
export function invertedWithInitials(name: CslName, suffixSeparator = ', '): string {
  if (name.literal) return name.literal
  const family = familyName(name)
  const given = [name.given ? initials(name.given) : '', name['dropping-particle']]
    .filter(Boolean)
    .join(' ')
  const base = given ? `${family}, ${given}` : family
  return name.suffix ? `${base}${suffixSeparator}${name.suffix}` : base
}

/** "J. A. Smith" (IEEE, APA editors). */
export function initialsFirst(name: CslName, suffixSeparator = ', '): string {
  if (name.literal) return name.literal
  const base = [name.given ? initials(name.given) : '', name['dropping-particle'], familyName(name)]
    .filter(Boolean)
    .join(' ')
  return name.suffix ? `${base}${suffixSeparator}${name.suffix}` : base
}

/** "Smith, John" (Chicago, first author). */
export function invertedFull(name: CslName): string {
  if (name.literal) return name.literal
  const family = familyName(name)
  const given = [name.given, name['dropping-particle']].filter(Boolean).join(' ')
  const base = given ? `${family}, ${given}` : family
  return name.suffix ? `${base}, ${name.suffix}` : base
}

/** "John Smith Jr." (Chicago, other authors and editors). */
export function givenFirst(name: CslName): string {
  if (name.literal) return name.literal
  return [name.given, name['dropping-particle'], familyName(name), name.suffix]
    .filter(Boolean)
    .join(' ')
}

/** Join a list as "A, B, and C" with configurable separators. */
export function joinList(
  items: string[],
  { separator = ', ', last, pair }: { separator?: string; last: string; pair?: string }
): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]}${pair ?? last}${items[1]}`
  return `${items.slice(0, -1).join(separator)}${last}${items.at(-1)}`
}

/** A sort key for a list of names: family, then given or initials, per author. */
export function namesSortKey(names: CslName[], useInitials: boolean): string {
  return names
    .map((n) => {
      if (n.literal) return sortableText(n.literal)
      const given = n.given ? (useInitials ? initials(n.given) : n.given) : ''
      return sortableText(`${familyName(n)} ${given}`)
    })
    .join('\u0001')
}

export function titleSortKey(title: string | undefined): string {
  return sortableText((title ?? '').replace(/^(?:the|an?)\s+/i, ''))
}

// ---------------------------------------------------------------------------
// Numbers, pages, locators

export function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

const EDITION_WORDS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
]

/**
 * "2" / "2nd" / "Second edition" → { text: "2nd", numeric: true }; other text
 * ("Rev. ed.") is returned as is. A first edition is never cited.
 */
export function edition(value: string | undefined): { text: string; numeric: boolean } | null {
  const raw = value?.trim()
  if (!raw) return null
  const numeric = /^(\d+)(?:st|nd|rd|th)?\.?(?:\s*(?:ed\.?|edn\.?|edition))?$/i.exec(raw)
  const word = EDITION_WORDS.indexOf(raw.toLowerCase().replace(/\s*(?:ed\.?|edn\.?|edition)$/, ''))
  const n = numeric ? Number(numeric[1]) : word >= 0 ? word + 1 : null
  if (n === 1) return null
  if (n) return { text: ordinal(n), numeric: true }
  return { text: raw, numeric: false }
}

function chicagoPair(a: string, b: string): string {
  const first = Number(a)
  const last = Number(b)
  // Chicago (9.61): abbreviate the second number of an inclusive range.
  if (!(last > first) || first < 100 || first % 100 === 0 || a.length !== b.length) {
    return `${a}–${b}`
  }
  let common = 0
  while (common < a.length - 1 && a[common] === b[common]) common++
  const changed = b.slice(common)
  // 101–108 → 101–8; 321–328 → 321–28 (at least two digits from 110 on).
  if (first % 100 < 10) return `${a}–${changed.replace(/^0+(?=\d)/, '')}`
  return `${a}–${changed.length >= 2 ? changed : b.slice(-2)}`
}

/** Page ranges with an en dash; `chicago` also abbreviates the second number. */
export function pageRange(page: string, mode: 'full' | 'chicago' = 'full'): string {
  return page
    .trim()
    .replace(/([^\s,–—-]+)\s*(?:-+|–|—)\s*([^\s,–—-]+)/g, (_, a: string, b: string) =>
      mode === 'chicago' && /^\d+$/.test(a) && /^\d+$/.test(b) ? chicagoPair(a, b) : `${a}–${b}`
    )
}

export function isPlural(locator: string): boolean {
  return /[-–—,&]|\band\b/.test(locator)
}

/** "p. 4" / "pp. 4–5" / "Chapter 3" from a label → [singular, plural] table. */
export function formatLocator(
  ref: CitationItemRef,
  terms: Record<LocatorLabel, [string, string]>,
  mode: 'full' | 'chicago' = 'full'
): string {
  const locator = ref.locator?.trim()
  if (!locator) return ''
  const [singular, plural] = terms[ref.label ?? 'page']
  const term = isPlural(locator) ? plural : singular
  const value = pageRange(locator, mode)
  return term ? `${term} ${value}` : value
}

export function doiUrl(doi: string): string {
  return `https://doi.org/${doi}`
}

/** 'phd' | 'masters' | null from a thesis genre such as "PhD thesis" or "Doctoral dissertation". */
export function thesisKind(genre: string | undefined): 'phd' | 'masters' | null {
  if (!genre) return null
  if (/master|\bm\.?\s?sc?\.?(?:\s|$)|\bm\.?a\.?(?:\s|$)|\bmphil\b/i.test(genre)) return 'masters'
  if (/ph\.?\s?d|doctor|dissertation|habilitation/i.test(genre)) return 'phd'
  return null
}

/** The repository/server for a preprint: container-title, archive, then publisher. */
export function repositoryOf(item: CslItem): string | undefined {
  return item['container-title'] ?? item.archive ?? item.publisher
}

/** Same text, ignoring case and punctuation (e.g. a publisher that is also the author). */
export function sameText(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b && sortableText(a) === sortableText(b))
}

export function firstLiteralAuthor(item: CslItem): string | undefined {
  const names = item.author ?? []
  return names.length === 1 ? names[0]!.literal : undefined
}
