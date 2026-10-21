import type { CslDate, CslItem, CslName } from './csl'
import {
  dateBits,
  edition,
  familyName,
  formatLocator,
  initialsFirst,
  isPlural,
  joinList,
  kindOf,
  type LocatorLabel,
  MONTHS_IEEE,
  type NumericStyle,
  pageRange,
  repositoryOf,
  thesisKind,
} from './format-common'
import { cat, dot, italic, join, quoted, type Rich } from './rich'

// IEEE Reference Guide (IEEE Periodicals, 2018 and later revisions).

const TERMS: Record<LocatorLabel, [string, string]> = {
  page: ['p.', 'pp.'],
  chapter: ['Ch.', 'Chs.'],
  section: ['Sec.', 'Secs.'],
  figure: ['Fig.', 'Figs.'],
  paragraph: ['para.', 'paras.'],
  line: ['l.', 'll.'],
  volume: ['vol.', 'vols.'],
}

// Up to six names are listed; beyond six, the first author and "et al.".
function nameList(names: CslName[]): string {
  if (names.length > 6) return `${initialsFirst(names[0]!)} et al.`
  return joinList(
    names.map((n) => initialsFirst(n)),
    { last: ', and ', pair: ' and ' }
  )
}

function dateText(date: CslDate | undefined): string {
  const { year, month, literal } = dateBits(date)
  if (!year) return literal ?? ''
  return month ? `${MONTHS_IEEE[month - 1]} ${year}` : String(year)
}

function dayText(date: CslDate | undefined): string {
  const { year, month, day } = dateBits(date)
  if (!year || !month) return year ? String(year) : ''
  return `${MONTHS_IEEE[month - 1]} ${day ? `${day}, ` : ''}${year}`
}

function pages(item: CslItem): string {
  if (item.page) return `${isPlural(item.page) ? 'pp.' : 'p.'} ${pageRange(item.page)}`
  if (item.number && item.type === 'article-journal') return `Art. no. ${item.number}`
  return ''
}

function editionText(value: string | undefined): string {
  const ed = edition(value)
  if (!ed) return ''
  return ed.numeric ? `${ed.text} ed.` : ed.text
}

function publisherBlock(item: CslItem): string {
  const place = item['publisher-place']
  if (place && item.publisher) return `${place}: ${item.publisher}`
  return item.publisher ?? place ?? ''
}

function names(item: CslItem): string {
  if (item.author?.length) return nameList(item.author)
  const kind = kindOf(item)
  if (item.editor?.length && kind !== 'part' && kind !== 'periodical') {
    return `${nameList(item.editor)}, ${item.editor.length > 1 ? 'Eds.' : 'Ed.'}`
  }
  return ''
}

/** Names, “Title,” body. — the shape of most IEEE entries. */
function withQuotedTitle(authors: string, title: string, body: Rich): Rich {
  if (!body.text) return join([authors, quoted(title, '.')], ', ')
  return dot(cat(join([authors, quoted(title, ',')], ', '), ' ', body))
}

function entryBody(item: CslItem): Rich {
  const authors = names(item)
  const title = item.title ?? ''
  const date = dateText(item.issued)
  const doi = item.DOI ? `doi: ${item.DOI}` : ''
  const container = item['container-title']

  switch (kindOf(item)) {
    case 'periodical':
      return withQuotedTitle(
        authors,
        title,
        join(
          [
            italic(container),
            item.volume && `vol. ${item.volume}`,
            item.issue && `no. ${item.issue}`,
            pages(item),
            date,
            doi,
          ],
          ', '
        )
      )
    case 'part': {
      if (item.type === 'paper-conference') {
        return withQuotedTitle(
          authors,
          title,
          join(
            [
              container && cat('in ', italic(container)),
              item['publisher-place'],
              date,
              pages(item),
              doi,
            ],
            ', '
          )
        )
      }
      const editors = item.editor?.length
        ? `${nameList(item.editor)}, ${item.editor.length > 1 ? 'Eds.' : 'Ed.'}`
        : ''
      const inPart = join(
        [container && cat('in ', italic(container)), editionText(item.edition), editors],
        ', '
      )
      const published = join([publisherBlock(item), date, pages(item), doi], ', ')
      // "in *Book*, A. Editor, Ed. City: Publisher, 2020, pp. 1–10."
      const body = publisherBlock(item)
        ? join([dot(inPart), published], ' ')
        : join([inPart, published], ', ')
      return withQuotedTitle(authors, title, body)
    }
    case 'report': {
      const label = item.genre ? (/tech/i.test(item.genre) ? 'Tech. Rep.' : item.genre) : 'Rep.'
      const number = item.number ? `${label} ${item.number}` : item.genre ? label : ''
      return withQuotedTitle(
        authors,
        title,
        join([item.publisher, item['publisher-place'], number, date, doi], ', ')
      )
    }
    case 'thesis': {
      const t = thesisKind(item.genre)
      const label =
        t === 'phd'
          ? 'Ph.D. dissertation'
          : t === 'masters'
            ? 'M.S. thesis'
            : (item.genre ?? 'Thesis')
      return withQuotedTitle(
        authors,
        title,
        join([label, item.publisher, item['publisher-place'], date, doi], ', ')
      )
    }
    case 'preprint':
      return withQuotedTitle(
        authors,
        title,
        join([date, item.number ?? repositoryOf(item), doi], ', ')
      )
    case 'webpage': {
      // Websites: Author. “Title.” Site. URL (accessed Mon. D, YYYY).
      const site = item['container-title'] ?? item.publisher
      const head = join([authors && dot(authors), quoted(title, '.'), site && dot(site)], ' ')
      if (!item.URL) return head
      const accessed = item.accessed ? ` (accessed ${dayText(item.accessed)}).` : ''
      return join([head, `${item.URL}${accessed}`], ' ')
    }
    default: {
      // Books and other stand-alone works: *Title*, 2nd ed. City: Publisher, 2020.
      const head = join(
        [
          authors,
          cat(italic(title), editionText(item.edition) && `, ${editionText(item.edition)}`),
        ],
        ', '
      )
      const published = join([publisherBlock(item), date, doi], ', ')
      return published.text ? cat(dot(head), ' ', dot(published)) : dot(head)
    }
  }
}

function entry(item: CslItem): Rich {
  const body = entryBody(item)
  // Without a DOI, an online source ends with its address.
  if (!item.DOI && item.URL && kindOf(item) !== 'webpage') {
    return join([body, `[Online]. Available: ${item.URL}`], ' ')
  }
  return body
}

export const ieee: NumericStyle = {
  kind: 'numeric',
  citeNames(item) {
    const list = item.author?.length ? item.author : (item.editor ?? [])
    if (!list.length) return null
    if (list.length === 1) return familyName(list[0]!)
    if (list.length === 2) return `${familyName(list[0]!)} and ${familyName(list[1]!)}`
    return `${familyName(list[0]!)} et al.`
  },
  locator: (ref) => formatLocator(ref, TERMS),
  entry,
  label: (n) => `[${n}] `,
  superscript: false,
}
