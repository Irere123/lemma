import type { CslItem, CslName } from './csl'
import {
  type AuthorDateStyle,
  dateBits,
  datedToTheDay,
  doiUrl,
  edition,
  familyName,
  firstLiteralAuthor,
  formatLocator,
  initials,
  initialsFirst,
  invertedWithInitials,
  isPlural,
  joinList,
  type Kind,
  kindOf,
  type LocatorLabel,
  longDate,
  MONTHS,
  namesSortKey,
  pageRange,
  repositoryOf,
  sameText,
  thesisKind,
  titleSortKey,
} from './format-common'
import { cat, dot, EMPTY, italic, join, type Rich, rich, wrap } from './rich'

// APA Style, 7th edition (Publication Manual, ch. 8–10). Titles are printed
// as stored: APA wants sentence case, but changing case automatically would
// break proper nouns and acronyms.

const TERMS: Record<LocatorLabel, [string, string]> = {
  page: ['p.', 'pp.'],
  chapter: ['Chapter', 'Chapters'],
  section: ['Section', 'Sections'],
  figure: ['Figure', 'Figures'],
  paragraph: ['para.', 'paras.'],
  line: ['line', 'lines'],
  volume: ['Vol.', 'Vols.'],
}

/** Authors, or for a whole edited book its editors, who then lead the entry. */
function leadNames(item: CslItem, kind: Kind): { names: CslName[]; editors: boolean } {
  if (item.author?.length) return { names: item.author, editors: false }
  if (item.editor?.length && kind !== 'part' && kind !== 'periodical') {
    return { names: item.editor, editors: true }
  }
  return { names: [], editors: false }
}

// Reference list: every author up to 20; beyond that the first 19, an
// ellipsis and the final author (9.8). A comma precedes "&" even for two.
function authorList(names: CslName[]): string {
  const list = names.map((n) => invertedWithInitials(n))
  if (list.length > 20) return `${list.slice(0, 19).join(', ')}, . . . ${list.at(-1)}`
  return joinList(list, { last: ', & ' })
}

// Editors and translators in running position: "J. Smith & K. Lee".
function personList(names: CslName[]): string {
  return joinList(
    names.map((n) => initialsFirst(n, ' ')),
    { last: ', & ', pair: ' & ' }
  )
}

function roleLabel(names: CslName[], one: string, many: string): string {
  return names.length > 1 ? many : one
}

function dateText(item: CslItem, yearLabel: string): string {
  const { year, month, day } = dateBits(item.issued)
  if (!year || !month || !datedToTheDay(item)) return yearLabel
  return `${yearLabel}, ${MONTHS[month - 1]}${day ? ` ${day}` : ''}`
}

function editionText(value: string | undefined): string {
  const ed = edition(value)
  if (!ed) return ''
  return ed.numeric ? `${ed.text} ed.` : ed.text
}

function bracketDescription(item: CslItem, kind: Kind): string {
  if (kind === 'thesis') {
    const t = thesisKind(item.genre)
    const label =
      t === 'phd'
        ? 'Doctoral dissertation'
        : t === 'masters'
          ? "Master's thesis"
          : (item.genre ?? 'Thesis')
    return `[${join([label, item.publisher], ', ').text}]`
  }
  switch (item.type) {
    case 'dataset':
      return '[Data set]'
    case 'software':
      return '[Computer software]'
    case 'manuscript':
      return '[Unpublished manuscript]'
    case 'motion_picture':
      return '[Film]'
  }
  return item.genre && (kind === 'preprint' || kind === 'other') ? `[${item.genre}]` : ''
}

function parenthetical(item: CslItem, kind: Kind, hasAuthors: boolean): string {
  if (kind === 'report') {
    return item.number ? `${item.genre ?? 'Report'} No. ${item.number}` : ''
  }
  if (kind === 'preprint') return item.number ?? ''
  if (kind === 'webpage' || kind === 'thesis') return ''
  const people: string[] = []
  if (hasAuthors && item.editor?.length) {
    people.push(`${personList(item.editor)}, ${roleLabel(item.editor, 'Ed.', 'Eds.')}`)
  }
  if (item.translator?.length) people.push(`${personList(item.translator)}, Trans.`)
  const details = join([editionText(item.edition), item.volume && `Vol. ${item.volume}`], ', ').text
  return [...people, details].filter(Boolean).join('; ')
}

function titleElement(item: CslItem, kind: Kind, hasAuthors: boolean): Rich {
  const title = item.title ?? ''
  if (kind === 'periodical' || kind === 'part') return rich(title)
  const extra = parenthetical(item, kind, hasAuthors)
  return join([italic(title), wrap('(', extra, ')'), bracketDescription(item, kind)], ' ')
}

function pagesLabel(page: string): string {
  return `${isPlural(page) ? 'pp.' : 'p.'} ${pageRange(page)}`
}

function sourceParts(item: CslItem, kind: Kind): Rich[] {
  const container = item['container-title']
  const authorName = firstLiteralAuthor(item)
  switch (kind) {
    case 'periodical': {
      const volumeIssue = item.volume
        ? cat(italic(item.volume), wrap('(', item.issue, ')'))
        : wrap('(', item.issue, ')')
      const pages = item.page
        ? pageRange(item.page)
        : item.number && item.type === 'article-journal'
          ? `Article ${item.number}`
          : ''
      return [join([italic(container), volumeIssue, pages], ', ')]
    }
    case 'part': {
      const editors = item.editor?.length
        ? `${personList(item.editor)} (${roleLabel(item.editor, 'Ed.', 'Eds.')}), `
        : ''
      const details = join(
        [
          editionText(item.edition),
          item.volume && `Vol. ${item.volume}`,
          item.page && pagesLabel(item.page),
        ],
        ', '
      )
      const inPart =
        container || editors
          ? cat('In ', editors, italic(container), wrap(' (', details, ')'))
          : EMPTY
      return [inPart, rich(item.publisher)]
    }
    case 'thesis':
      // The institution is in the bracket; a database or archive follows.
      return [rich(item.archive)]
    case 'webpage': {
      const site = container ?? item.publisher
      return [rich(sameText(site, authorName) ? undefined : site)]
    }
    case 'preprint':
      return [rich(repositoryOf(item))]
    default:
      // A publisher that is also the (group) author is not repeated (9.29).
      return [rich(sameText(item.publisher, authorName) ? undefined : item.publisher)]
  }
}

function link(item: CslItem, kind: Kind): string {
  if (item.DOI) return doiUrl(item.DOI)
  if (!item.URL) return ''
  // Retrieval dates are for pages that change over time; we give one when
  // an undated web page has an access date, as APA's own examples do (9.16).
  if (kind === 'webpage' && !dateBits(item.issued).year && item.accessed) {
    const accessed = longDate(item.accessed)
    if (accessed) return `Retrieved ${accessed}, from ${item.URL}`
  }
  return item.URL
}

function entry(item: CslItem, yearLabel: string): Rich {
  const kind = kindOf(item)
  const lead = leadNames(item, kind)
  const date = `(${dateText(item, yearLabel)})`
  const title = titleElement(item, kind, Boolean(item.author?.length))
  const parts: Rich[] = []
  if (lead.names.length) {
    const names = authorList(lead.names)
    parts.push(
      dot(lead.editors ? `${names} (${roleLabel(lead.names, 'Ed.', 'Eds.')})` : names),
      dot(date),
      dot(title)
    )
  } else {
    // No author: the title moves into the author position (9.12).
    parts.push(dot(title), dot(date))
  }
  for (const source of sourceParts(item, kind)) parts.push(dot(source))
  parts.push(rich(link(item, kind)))
  return join(parts, ' ')
}

function citeNames(item: CslItem, narrative: boolean, withInitials: boolean): string | null {
  const { names } = leadNames(item, kindOf(item))
  const first = names[0]
  if (!first) return null
  // Different first authors who share a surname get initials (8.20).
  const firstText =
    withInitials && !first.literal && first.given
      ? `${initials(first.given)} ${familyName(first)}`
      : familyName(first)
  if (names.length === 1) return firstText
  if (names.length === 2)
    return `${firstText}${narrative ? ' and ' : ' & '}${familyName(names[1]!)}`
  return `${firstText} et al.`
}

export const apa: AuthorDateStyle = {
  kind: 'author-date',
  citeNames,
  citeTitle(item) {
    // Titles italic in the reference list are italic in the text; others are quoted (8.14).
    const kind = kindOf(item)
    return { title: item.title ?? 'Untitled', quoted: kind === 'periodical' || kind === 'part' }
  },
  yearDelimiter: ', ',
  locator: (ref) => formatLocator(ref, TERMS),
  entry,
  sortNames(item) {
    const { names } = leadNames(item, kindOf(item))
    return names.length ? namesSortKey(names, true) : titleSortKey(item.title)
  },
  undatedFirst: true,
  sortCitations: true,
}
