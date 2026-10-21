import type { CslItem, CslName, CslType } from './csl'
import { dateBits, thesisKind } from './format-common'

// CSL → BibLaTeX-flavoured BibTeX for Pandoc/Quarto export, where the text
// cites items as [@key]. Values stay UTF-8 (biber and Pandoc read it); only
// TeX's special characters are escaped.

const MONTH_MACROS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
]

const TYPES: Partial<Record<CslType, string>> = {
  'article-journal': 'article',
  'article-magazine': 'article',
  'article-newspaper': 'article',
  review: 'article',
  'review-book': 'article',
  book: 'book',
  pamphlet: 'booklet',
  chapter: 'incollection',
  'entry-encyclopedia': 'incollection',
  'entry-dictionary': 'incollection',
  entry: 'incollection',
  'paper-conference': 'inproceedings',
  report: 'techreport',
  webpage: 'online',
  post: 'online',
  'post-weblog': 'online',
  manuscript: 'unpublished',
  dataset: 'dataset',
  software: 'software',
  patent: 'patent',
}

const SPECIAL: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  '&': '\\&',
  '%': '\\%',
  $: '\\$',
  '#': '\\#',
  _: '\\_',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
}

/** Escape TeX's special characters: & % $ # _ { } ~ ^ \ */
export function escapeBibTeX(value: string): string {
  return value.replace(/[\\{}&%$#_~^]/g, (ch) => SPECIAL[ch]!)
}

/**
 * Titles: escape, and brace words with capitals after the first letter
 * (DNA, iPhone, McDonald) so Pandoc's sentence-casing of English BibTeX
 * titles leaves them alone.
 */
function escapeTitle(value: string): string {
  return value
    .split(/(\s+)/)
    .map((word) => {
      const escaped = escapeBibTeX(word)
      return /^\S.*\p{Lu}/u.test(word) && /\p{L}/u.test(word.slice(1)) ? `{${escaped}}` : escaped
    })
    .join('')
}

/** A key safe for both BibTeX and Pandoc's [@key] syntax. */
export function toBibTeXKey(id: string): string {
  const key = id.trim().replace(/[^A-Za-z0-9_:.+/-]/g, '_')
  return key || 'ref'
}

function name(n: CslName): string {
  if (n.literal) return `{${escapeBibTeX(n.literal)}}`
  const family = [n['non-dropping-particle'], n.family].filter(Boolean).join(' ')
  const given = [n.given, n['dropping-particle']].filter(Boolean).join(' ')
  // "von Last, Jr, First" keeps particles and suffixes unambiguous.
  const parts = [family, n.suffix, given].filter((p): p is string => Boolean(p))
  return parts.map(escapeBibTeX).join(', ')
}

function names(list: CslName[] | undefined): string | undefined {
  return list?.length ? list.map(name).join(' and ') : undefined
}

function isoDate(date: CslItem['accessed']): string | undefined {
  const { year, month, day } = dateBits(date)
  if (!year) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  return [String(year).padStart(4, '0'), month && pad(month), month && day && pad(day)]
    .filter(Boolean)
    .join('-')
}

function entryType(item: CslItem): string {
  if (item.type === 'thesis') {
    const kind = thesisKind(item.genre)
    return kind === 'masters' ? 'mastersthesis' : kind === 'phd' ? 'phdthesis' : 'thesis'
  }
  return TYPES[item.type] ?? 'misc'
}

function entry(item: CslItem, key: string): string {
  const type = entryType(item)
  const fields: [string, string, 'braced' | 'raw'][] = []
  const add = (field: string, value: string | undefined, mode: 'braced' | 'raw' = 'braced') => {
    if (value) fields.push([field, value, mode])
  }
  const text = (value: string | undefined) => (value ? escapeBibTeX(value) : undefined)

  add('author', names(item.author))
  add('editor', names(item.editor))
  add('translator', names(item.translator))
  add('title', item.title ? escapeTitle(item.title) : undefined)

  const container = text(item['container-title'])
  if (type === 'article') add('journal', container)
  else if (type === 'incollection' || type === 'inproceedings') add('booktitle', container)
  else if (type === 'online') add('organization', container)
  else if (item.type === 'article' && item.archive?.toLowerCase() !== container?.toLowerCase()) {
    add('howpublished', container)
  }
  add('series', text(item['collection-title']))
  add('eventtitle', text(item['event-title']))

  const { year, month, day, literal } = dateBits(item.issued)
  if (year) {
    add('year', String(year))
    if (month) add('month', MONTH_MACROS[month - 1], 'raw')
    // biblatex/Pandoc read `date`; plain BibTeX ignores it and uses year/month.
    if (day) add('date', isoDate(item.issued))
  } else if (literal) {
    add('year', escapeBibTeX(literal))
  }

  add('volume', text(item.volume))
  if (type === 'article') add('number', text(item.issue ?? item.number))
  else {
    add('number', text(item.number))
    add('issue', text(item.issue))
  }
  add('pages', item.page ? escapeBibTeX(item.page.replace(/\s*[-–—]+\s*/g, '--')) : undefined)
  add('pagetotal', text(item['number-of-pages']))
  add('edition', text(item.edition))

  const publisher = text(item.publisher)
  if (type === 'techreport') add('institution', publisher)
  else if (type.endsWith('thesis')) add('school', publisher)
  else if (type !== 'online' || !container) add('publisher', publisher)
  add('address', text(item['publisher-place']))
  if (item.genre && (type === 'techreport' || type === 'thesis')) add('type', text(item.genre))

  // arXiv preprints: eprint + archivePrefix (biblatex reads it as eprinttype).
  const arxiv = /^arxiv:(.+)$/i.exec(item.number ?? '')
  if (
    arxiv &&
    (item.archive?.toLowerCase() === 'arxiv' || /arxiv/i.test(item['container-title'] ?? ''))
  ) {
    add('eprint', arxiv[1])
    add('archiveprefix', 'arXiv')
    const numberIndex = fields.findIndex(([f]) => f === 'number')
    if (numberIndex >= 0) fields.splice(numberIndex, 1)
  }

  // Verbatim fields: no TeX escaping, only braces would break the value.
  add('doi', item.DOI?.replace(/[{}]/g, ''))
  add('url', item.URL?.replace(/[{}]/g, ''))
  add('urldate', isoDate(item.accessed))
  add('isbn', text(item.ISBN))
  add('issn', text(item.ISSN))
  add('langid', text(item.language))
  add('note', text(item.note))
  add('abstract', text(item.abstract))

  const body = fields
    .map(([field, value, mode]) => `  ${field} = ${mode === 'raw' ? value : `{${value}}`}`)
    .join(',\n')
  return `@${type}{${key}${body ? `,\n${body}` : ''}\n}`
}

/** Serialise items as a .bib file; keys come from `toBibTeXKey(item.id)`. */
export function toBibTeX(items: CslItem[]): string {
  if (!items.length) return ''
  return `${items.map((item) => entry(item, toBibTeXKey(item.id))).join('\n\n')}\n`
}
