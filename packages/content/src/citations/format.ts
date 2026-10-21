import type { CslItem, CslName } from './csl'
import {
  type AuthorDateStyle,
  type CitationCluster,
  type CitationItemRef,
  dateBits,
  familyName,
  initials,
  kindOf,
  type NumericStyle,
  type Style,
  type StyleId,
  titleSortKey,
} from './format-common'
import { cat, EMPTY, italic, join, quoted, type Rich, rich, superscript } from './rich'
import { apa } from './style-apa'
import { chicago } from './style-chicago'
import { ieee } from './style-ieee'
import { nature } from './style-nature'
import { sortableText } from './util'

// A small citation processor: in-text citations and a bibliography for the
// four styles below, written by hand from the style guides (no citeproc).

export type { CitationCluster, CitationItemRef, LocatorLabel, StyleId } from './format-common'

/** Plain text, and HTML that is escaped and uses only <i> and <sup>. */
export type Formatted = { text: string; html: string }

export type BibliographyEntry = { id: string; number?: number; text: string; html: string }

export type ProcessResult = {
  /** One per input cluster, in the same order. */
  clusters: Formatted[]
  /** Cited items only: alphabetical for author-date styles, by number for numeric ones. */
  bibliography: BibliographyEntry[]
  /** Cited ids that are not in the library, in order of first appearance. */
  missing: string[]
}

export type CitationProcessor = { process(clusters: CitationCluster[]): ProcessResult }

export const STYLES: { id: StyleId; label: string; kind: 'author-date' | 'numeric' }[] = [
  { id: 'apa', label: 'APA 7th edition', kind: 'author-date' },
  { id: 'chicago', label: 'Chicago 17th edition (author-date)', kind: 'author-date' },
  { id: 'ieee', label: 'IEEE', kind: 'numeric' },
  { id: 'nature', label: 'Nature', kind: 'numeric' },
]

const IMPLEMENTATIONS: Record<StyleId, Style> = { apa, chicago, ieee, nature }

type Cited = { id: string; item: CslItem }
type Ref = { ref: CitationItemRef; item: CslItem | undefined }

/** "see (…)" and "(…), for details": prefixes take a space, suffixes a comma unless they bring punctuation. */
function withAffixes(ref: CitationItemRef, body: Rich): Rich {
  const prefix = ref.prefix?.trim()
  const suffix = ref.suffix?.trim()
  let out = body
  if (prefix) out = cat(prefix, ' ', out)
  if (suffix) out = cat(out, /^[,;:.!?)]/.test(suffix) ? '' : ', ', suffix)
  return out
}

function plain(ref: CitationItemRef): boolean {
  return !ref.locator?.trim() && !ref.prefix?.trim() && !ref.suffix?.trim()
}

// ---------------------------------------------------------------------------
// Author-date

// The names an author-date citation starts with (editors for an edited book).
function leadNames(item: CslItem): CslName[] {
  if (item.author?.length) return item.author
  const kind = kindOf(item)
  return kind !== 'part' && kind !== 'periodical' && item.editor?.length ? item.editor : []
}

function processAuthorDate(
  style: AuthorDateStyle,
  library: Map<string, CslItem>,
  cited: Cited[],
  clusters: CitationCluster[],
  missing: string[]
): ProcessResult {
  const year = (item: CslItem) => dateBits(item.issued).year
  const order = new Map(cited.map((c, i) => [c.id, i]))

  // Reference-list order: names, then year, then title.
  const sorted = [...cited].sort((a, b) => {
    const na = style.sortNames(a.item)
    const nb = style.sortNames(b.item)
    if (na !== nb) return na < nb ? -1 : 1
    const ya = year(a.item)
    const yb = year(b.item)
    if (ya !== yb) {
      if (ya === undefined) return style.undatedFirst ? -1 : 1
      if (yb === undefined) return style.undatedFirst ? 1 : -1
      return ya - yb
    }
    const ta = titleSortKey(a.item.title)
    const tb = titleSortKey(b.item.title)
    if (ta !== tb) return ta < tb ? -1 : 1
    return order.get(a.id)! - order.get(b.id)!
  })
  const rank = new Map(sorted.map((c, i) => [c.id, i]))

  // Different first authors with the same surname are told apart by initials
  // (APA 8.20, CMOS 15.21).
  const initialsByFamily = new Map<string, Set<string>>()
  for (const { item } of sorted) {
    const first = leadNames(item)[0]
    if (!first || first.literal) continue
    const family = sortableText(familyName(first))
    const set = initialsByFamily.get(family) ?? new Set<string>()
    set.add(sortableText(initials(first.given ?? '')))
    initialsByFamily.set(family, set)
  }
  const needsInitials = (item: CslItem): boolean => {
    const first = leadNames(item)[0]
    if (!first || first.literal || !first.given) return false
    return (initialsByFamily.get(sortableText(familyName(first)))?.size ?? 0) > 1
  }

  const authorKey = (item: CslItem): string =>
    style.citeNames(item, false, needsInitials(item)) ?? `\u0000${item.title ?? ''}`
  const yearBase = (item: CslItem): string => {
    const bits = dateBits(item.issued)
    return bits.year ? String(bits.year) : (bits.literal ?? 'n.d.')
  }

  // Works whose short citation would be identical get a, b, c … in
  // reference-list order (APA 8.19, CMOS 15.19).
  const groups = new Map<string, string[]>()
  for (const { id, item } of sorted) {
    const key = `${authorKey(item)}\u0001${yearBase(item)}`
    groups.set(key, [...(groups.get(key) ?? []), id])
  }
  const yearLabels = new Map<string, string>()
  for (const { id, item } of sorted) {
    const base = yearBase(item)
    const group = groups.get(`${authorKey(item)}\u0001${base}`)!
    if (group.length < 2) {
      yearLabels.set(id, base)
      continue
    }
    const letter = String.fromCharCode(97 + group.indexOf(id))
    yearLabels.set(id, dateBits(item.issued).year ? `${base}${letter}` : `${base}-${letter}`)
  }

  const lead = (item: CslItem, narrative: boolean): { names: Rich; quotedTitle?: string } => {
    const names = style.citeNames(item, narrative, needsInitials(item))
    if (names) return { names: rich(names) }
    const { title, quoted: isQuoted } = style.citeTitle(item)
    return isQuoted ? { names: EMPTY, quotedTitle: title } : { names: italic(title) }
  }

  const yearAndLocator = (id: string, ref: CitationItemRef): Rich =>
    join([yearLabels.get(id), style.locator(ref)], ', ')

  const renderCluster = (cluster: CitationCluster): Formatted => {
    const refs: Ref[] = cluster.items.map((ref) => ({ ref, item: library.get(ref.id) }))
    if (!refs.length) return EMPTY
    if (style.sortCitations && refs.length > 1) {
      refs.sort(
        (a, b) =>
          (rank.get(a.ref.id) ?? Number.POSITIVE_INFINITY) -
          (rank.get(b.ref.id) ?? Number.POSITIVE_INFINITY)
      )
    }
    const mode = cluster.mode ?? 'normal'

    if (mode === 'author-in-text') {
      // Smith and Jones (2020, p. 4)
      return join(
        refs.map(({ ref, item }) => {
          if (!item) return rich(`(missing: ${ref.id})`)
          const { names, quotedTitle } = lead(item, true)
          const who = quotedTitle ? quoted(quotedTitle) : names
          return withAffixes(ref, cat(who, ' (', yearAndLocator(ref.id, ref), ')'))
        }),
        '; '
      )
    }

    // Consecutive works by the same authors share one name: (Smith, 2019, 2020a).
    const pieces: Rich[] = []
    let previousKey: string | null = null
    for (const { ref, item } of refs) {
      if (!item) {
        pieces.push(rich(`missing: ${ref.id}`))
        previousKey = null
        continue
      }
      const key = mode === 'normal' && plain(ref) ? authorKey(item) : null
      if (key !== null && key === previousKey) {
        pieces[pieces.length - 1] = cat(pieces.at(-1)!, ', ', yearLabels.get(ref.id))
        continue
      }
      previousKey = key
      let body: Rich
      if (mode === 'suppress-author') {
        body = yearAndLocator(ref.id, ref)
      } else {
        const { names, quotedTitle } = lead(item, false)
        const head = quotedTitle
          ? // APA puts the comma inside the quotes: (“Title,” 2020).
            cat(quoted(quotedTitle, style.yearDelimiter.trim()), ' ')
          : cat(names, style.yearDelimiter)
        body = cat(head, yearAndLocator(ref.id, ref))
      }
      pieces.push(withAffixes(ref, body))
    }
    return cat('(', join(pieces, '; '), ')')
  }

  return {
    clusters: clusters.map(renderCluster),
    bibliography: sorted.map(({ id, item }) => {
      const entry = style.entry(item, yearLabels.get(id)!)
      return { id, text: entry.text, html: entry.html }
    }),
    missing,
  }
}

// ---------------------------------------------------------------------------
// Numeric

function processNumeric(
  style: NumericStyle,
  library: Map<string, CslItem>,
  cited: Cited[],
  clusters: CitationCluster[],
  missing: string[]
): ProcessResult {
  // Numbered in order of first citation.
  const numbers = new Map(cited.map((c, i) => [c.id, i + 1]))
  const bracket = (inner: string): string => (style.superscript ? inner : `[${inner}]`)
  const marker = (ref: CitationItemRef): string => {
    const n = numbers.get(ref.id)
    if (n === undefined) return '[?]'
    const locator = style.locator(ref)
    if (!locator) return bracket(String(n))
    // Superscripts keep the locator in parentheses so commas still separate numbers.
    return style.superscript ? `${n} (${locator})` : `[${n}, ${locator}]`
  }
  const finish = (body: Rich): Rich => (style.superscript ? superscript(body) : body)

  const renderCluster = (cluster: CitationCluster): Formatted => {
    if (!cluster.items.length) return EMPTY

    if (cluster.mode === 'author-in-text') {
      // Smith et al. [1] / Smith et al.¹
      return join(
        cluster.items.map((ref) => {
          const item = library.get(ref.id)
          const who = item ? (style.citeNames(item) ?? item.title ?? '') : ''
          const mark = finish(rich(marker(ref)))
          return withAffixes(ref, who ? cat(who, style.superscript ? '' : ' ', mark) : mark)
        }),
        '; '
      )
    }

    // Sort by number, drop repeats, and compress runs of three or more: [1]–[3], ¹⁻³.
    const seen = new Set<string>()
    const refs = cluster.items
      .filter((ref) => {
        if (!plain(ref)) return true
        if (seen.has(ref.id)) return false
        seen.add(ref.id)
        return true
      })
      .map((ref, i) => ({ ref, n: numbers.get(ref.id), i }))
      .sort(
        (a, b) => (a.n ?? Number.POSITIVE_INFINITY) - (b.n ?? Number.POSITIVE_INFINITY) || a.i - b.i
      )

    const pieces: Rich[] = []
    let k = 0
    while (k < refs.length) {
      const start = refs[k]!
      if (start.n === undefined || !plain(start.ref)) {
        pieces.push(withAffixes(start.ref, rich(marker(start.ref))))
        k++
        continue
      }
      let end = k
      while (
        end + 1 < refs.length &&
        refs[end + 1]!.n === refs[end]!.n! + 1 &&
        plain(refs[end + 1]!.ref)
      ) {
        end++
      }
      if (end - k >= 2) {
        pieces.push(rich(`${bracket(String(start.n))}–${bracket(String(refs[end]!.n))}`))
      } else {
        for (let j = k; j <= end; j++) pieces.push(rich(bracket(String(refs[j]!.n))))
      }
      k = end + 1
    }
    return finish(join(pieces, style.superscript ? ',' : ', '))
  }

  return {
    clusters: clusters.map(renderCluster),
    bibliography: cited.map(({ id, item }) => {
      const n = numbers.get(id)!
      const entry = cat(style.label(n), style.entry(item))
      return { id, number: n, text: entry.text, html: entry.html }
    }),
    missing,
  }
}

// ---------------------------------------------------------------------------

/**
 * Create a processor for one style over a library. `process` is pure: it
 * numbers, disambiguates and sorts from the clusters it is given each time.
 */
export function createCitationProcessor(
  style: StyleId,
  library: CslItem[] | Map<string, CslItem>
): CitationProcessor {
  const impl = IMPLEMENTATIONS[style]
  if (!impl) throw new Error(`Unknown citation style "${style}"`)
  const items = library instanceof Map ? library : new Map(library.map((item) => [item.id, item]))

  return {
    process(clusters) {
      const cited: Cited[] = []
      const seen = new Set<string>()
      const missing: string[] = []
      for (const cluster of clusters) {
        for (const ref of cluster.items) {
          if (seen.has(ref.id)) continue
          seen.add(ref.id)
          const item = items.get(ref.id)
          if (item) cited.push({ id: ref.id, item })
          else missing.push(ref.id)
        }
      }
      return impl.kind === 'author-date'
        ? processAuthorDate(impl, items, cited, clusters, missing)
        : processNumeric(impl, items, cited, clusters, missing)
    },
  }
}
