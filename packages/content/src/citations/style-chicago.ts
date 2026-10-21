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
  givenFirst,
  initials,
  invertedFull,
  joinList,
  type Kind,
  kindOf,
  type LocatorLabel,
  longDate,
  namesSortKey,
  pageRange,
  repositoryOf,
  sameText,
  thesisKind,
  titleSortKey,
} from './format-common'
import { cat, dot, italic, join, quoted, type Rich, rich } from './rich'

// The Chicago Manual of Style, 17th edition, author-date system (ch. 15),
// with the shortened 9.61 page ranges (321–28). Particles stay in front of
// the family name ("van Gogh, Vincent"): CMOS defers to each name's usage,
// and the stored form is the best record of it.

const TERMS: Record<LocatorLabel, [string, string]> = {
  page: ['', ''],
  chapter: ['chap.', 'chaps.'],
  section: ['sec.', 'secs.'],
  figure: ['fig.', 'figs.'],
  paragraph: ['para.', 'paras.'],
  line: ['line', 'lines'],
  volume: ['vol.', 'vols.'],
}

const QUOTED_KINDS = new Set<Kind>(['periodical', 'part', 'thesis', 'webpage', 'preprint'])

function leadNames(item: CslItem, kind: Kind): { names: CslName[]; editors: boolean } {
  if (item.author?.length) return { names: item.author, editors: false }
  if (item.editor?.length && kind !== 'part' && kind !== 'periodical') {
    return { names: item.editor, editors: true }
  }
  return { names: [], editors: false }
}

// Reference list: first name inverted, up to ten; more than ten → seven + et al. (15.9).
function authorList(names: CslName[]): string {
  const shown = names.length > 10 ? names.slice(0, 7) : names
  const list = shown.map((n, i) => (i === 0 ? invertedFull(n) : givenFirst(n)))
  if (names.length > 10) return `${list.join(', ')}, et al.`
  // "Smith, John, and Jane Jones" — the comma is needed after an inverted name.
  return joinList(list, { last: ', and ', pair: names[0]?.literal ? ' and ' : ', and ' })
}

function personList(names: CslName[]): string {
  return joinList(names.map(givenFirst), { last: ', and ', pair: ' and ' })
}

function editionText(value: string | undefined): string {
  const ed = edition(value)
  if (!ed) return ''
  return ed.numeric ? `${ed.text} ed.` : ed.text
}

function publisherBlock(item: CslItem): string {
  const place = item['publisher-place']
  const publisher = item.publisher
  if (place && publisher) return `${place}: ${publisher}`
  return publisher ?? place ?? ''
}

function periodicalSource(item: CslItem): Rich[] {
  const container = italic(item['container-title'])
  if (datedToTheDay(item)) {
    // Newspapers, magazines and blogs: name, then the full date (15.47–15.51).
    const name =
      item.type === 'post-weblog' && container.text ? cat(container, ' (blog)') : container
    const { month } = dateBits(item.issued)
    return [
      join([name, item.page && pageRange(item.page, 'chicago')], ', '),
      rich(month ? longDate(item.issued) : ''),
    ]
  }
  // *Journal* 12 (3): 45–67.
  let source = container
  if (item.volume) {
    source = join([source, item.volume], ' ')
    if (item.issue) source = cat(source, ` (${item.issue})`)
  } else if (item.issue) {
    source = join([source, `no. ${item.issue}`], ', ')
  }
  if (item.page) {
    const pages = pageRange(item.page, 'chicago')
    source = item.volume || item.issue ? cat(source, ': ', pages) : join([source, pages], ', ')
  }
  return [source]
}

function sourceParts(item: CslItem, kind: Kind, hasAuthors: boolean): Rich[] {
  switch (kind) {
    case 'periodical':
      return periodicalSource(item)
    case 'part': {
      const container = item['container-title']
      const inPart = join(
        [
          container && cat('In ', italic(container)),
          item.editor?.length ? `edited by ${personList(item.editor)}` : '',
          editionText(item.edition),
          item.page && pageRange(item.page, 'chicago'),
        ],
        ', '
      )
      return [inPart, rich(publisherBlock(item))]
    }
    case 'thesis': {
      const t = thesisKind(item.genre)
      const label =
        t === 'phd' ? 'PhD diss.' : t === 'masters' ? "Master's thesis" : (item.genre ?? 'Thesis')
      return [join([label, item.publisher], ', '), rich(item.archive)]
    }
    case 'report': {
      const number = item.number
        ? item.genre
          ? `${item.genre} ${item.number}`
          : `Report no. ${item.number}`
        : item.genre
      // Unlike APA, Chicago repeats a group author that is also the publisher.
      return [rich(number), rich(publisherBlock(item))]
    }
    case 'webpage': {
      const site = item['container-title'] ?? item.publisher
      const { year, month } = dateBits(item.issued)
      const accessed = !year && item.accessed ? longDate(item.accessed) : ''
      return [
        rich(sameText(site, firstLiteralAuthor(item)) ? undefined : site),
        rich(month ? longDate(item.issued) : ''),
        rich(accessed && `Accessed ${accessed}`),
      ]
    }
    case 'preprint': {
      // CMOS 14.176: "Preprint, submitted …"; the repository identifies it here,
      // and the arXiv number is only needed when there is no link.
      const repository = repositoryOf(item)
      const number = !item.DOI && !item.URL ? item.number : undefined
      return [rich(['Preprint', repository, number].filter(Boolean).join(', '))]
    }
    default: {
      const people = [
        hasAuthors && item.editor?.length ? `Edited by ${personList(item.editor)}` : '',
        item.translator?.length ? `Translated by ${personList(item.translator)}` : '',
      ]
      return [
        ...people.map((p) => rich(p)),
        rich(editionText(item.edition)),
        rich(item.volume && `Vol. ${item.volume}`),
        rich(publisherBlock(item)),
      ]
    }
  }
}

function titleElement(item: CslItem, kind: Kind): Rich {
  const title = item.title ?? ''
  if (!title) return rich('')
  return QUOTED_KINDS.has(kind) ? quoted(title, '.') : dot(italic(title))
}

function entry(item: CslItem, yearLabel: string): Rich {
  const kind = kindOf(item)
  const lead = leadNames(item, kind)
  const parts: Rich[] = []
  if (lead.names.length) {
    const names = authorList(lead.names)
    const role = lead.names.length > 1 ? 'eds.' : 'ed.'
    parts.push(
      dot(lead.editors ? `${names}, ${role}` : names),
      dot(yearLabel),
      titleElement(item, kind)
    )
  } else {
    parts.push(titleElement(item, kind), dot(yearLabel))
  }
  for (const source of sourceParts(item, kind, Boolean(item.author?.length)))
    parts.push(dot(source))
  const link = item.DOI ? doiUrl(item.DOI) : item.URL
  parts.push(dot(link))
  return join(parts, ' ')
}

function citeNames(item: CslItem, narrative: boolean, withInitials: boolean): string | null {
  const { names } = leadNames(item, kindOf(item))
  const first = names[0]
  if (!first) return null
  const firstText =
    withInitials && !first.literal && first.given
      ? `${initials(first.given)} ${familyName(first)}`
      : familyName(first)
  // Two or three authors are all named; four or more → first + et al. (15.29).
  if (names.length >= 4) return `${firstText} et al.`
  return joinList([firstText, ...names.slice(1).map(familyName)], { last: ', and ', pair: ' and ' })
}

export const chicago: AuthorDateStyle = {
  kind: 'author-date',
  citeNames,
  citeTitle(item) {
    return { title: item.title ?? 'Untitled', quoted: QUOTED_KINDS.has(kindOf(item)) }
  },
  yearDelimiter: ' ',
  locator: (ref) => formatLocator(ref, TERMS, 'chicago'),
  entry,
  sortNames(item) {
    const { names } = leadNames(item, kindOf(item))
    return names.length ? namesSortKey(names, false) : titleSortKey(item.title)
  },
  undatedFirst: false,
  sortCitations: false,
}
