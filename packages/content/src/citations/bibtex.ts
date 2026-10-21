import { makeCiteKey } from './citekey'
import type { CslDate, CslItem, CslName, CslType, ParseResult } from './csl'
import { MONTH_NAMES, monthFromString, parseDateString } from './dates'
import { cleanDoi, normalizeArxivId } from './identifiers'
import { decodeLatex } from './latex'
import { parseName, splitNameList } from './names'

// A tolerant BibTeX/BibLaTeX reader: @string macros with # concatenation,
// braced and quoted values, @comment/@preamble, % comment lines, and per-entry
// error recovery so one broken entry never loses the rest of the file.

class BibSyntaxError extends Error {
  constructor(
    message: string,
    readonly pos: number
  ) {
    super(message)
  }
}

type RawEntry = { type: string; key: string; fields: Map<string, string>; pos: number }

const TYPE_MAP: Record<string, CslType> = {
  article: 'article-journal',
  book: 'book',
  mvbook: 'book',
  proceedings: 'book',
  mvproceedings: 'book',
  collection: 'book',
  mvcollection: 'book',
  reference: 'book',
  manual: 'book',
  periodical: 'book',
  booklet: 'pamphlet',
  inbook: 'chapter',
  bookinbook: 'chapter',
  incollection: 'chapter',
  suppbook: 'chapter',
  suppcollection: 'chapter',
  inreference: 'entry-encyclopedia',
  inproceedings: 'paper-conference',
  conference: 'paper-conference',
  phdthesis: 'thesis',
  mastersthesis: 'thesis',
  thesis: 'thesis',
  techreport: 'report',
  report: 'report',
  online: 'webpage',
  www: 'webpage',
  electronic: 'webpage',
  webpage: 'webpage',
  unpublished: 'manuscript',
  dataset: 'dataset',
  data: 'dataset',
  software: 'software',
  patent: 'patent',
  standard: 'standard',
  movie: 'motion_picture',
  video: 'motion_picture',
}

const PERIODICAL_TYPES = new Set<CslType>([
  'article-journal',
  'article-magazine',
  'article-newspaper',
])

function lineAt(text: string, pos: number): number {
  let line = 1
  for (let i = 0; i < pos && i < text.length; i++) if (text.charCodeAt(i) === 10) line++
  return line
}

class Reader {
  pos = 0
  readonly macros = new Map<string, string>(
    MONTH_NAMES.map((name) => [name.slice(0, 3).toLowerCase(), name])
  )

  constructor(
    readonly text: string,
    readonly warnings: string[]
  ) {}

  private fail(message: string): never {
    throw new BibSyntaxError(message, this.pos)
  }

  private skipSpace(): void {
    const text = this.text
    while (this.pos < text.length) {
      const ch = text[this.pos]!
      if (ch === '%') {
        // A comment between fields runs to the end of the line.
        const end = text.indexOf('\n', this.pos)
        this.pos = end < 0 ? text.length : end + 1
      } else if (/\s/.test(ch)) {
        this.pos++
      } else {
        return
      }
    }
  }

  /** The next `@` that starts an entry, skipping text and % lines between entries. */
  private nextEntry(): number {
    const text = this.text
    while (this.pos < text.length) {
      const ch = text[this.pos]
      if (ch === '@') return this.pos
      if (ch === '%') {
        const end = text.indexOf('\n', this.pos)
        this.pos = end < 0 ? text.length : end + 1
      } else {
        this.pos++
      }
    }
    return -1
  }

  /** Content of a `{…}` group starting at pos, without the outer braces. */
  private braced(): string {
    const text = this.text
    const start = this.pos + 1
    let depth = 0
    for (; this.pos < text.length; this.pos++) {
      const ch = text[this.pos]
      if (ch === '\\') {
        this.pos++
      } else if (ch === '{') {
        depth++
      } else if (ch === '}' && --depth === 0) {
        this.pos++
        return text.slice(start, this.pos - 1)
      } else if (
        ch === '@' &&
        depth === 1 &&
        /\n[ \t]*$/.test(text.slice(Math.max(0, this.pos - 40), this.pos))
      ) {
        // A line starting with @ inside a value almost certainly means the
        // value was never closed; stop here so the next entry survives.
        this.fail('Unbalanced braces')
      }
    }
    return this.fail('Unterminated value')
  }

  private quoted(): string {
    const text = this.text
    const start = this.pos + 1
    let depth = 0
    for (this.pos++; this.pos < text.length; this.pos++) {
      const ch = text[this.pos]
      if (ch === '\\') this.pos++
      else if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '"' && depth <= 0) {
        this.pos++
        return text.slice(start, this.pos - 1)
      }
    }
    return this.fail('Unterminated quoted value')
  }

  /** A field value: braced/quoted strings, numbers and macros joined with `#`. */
  private value(): string {
    let out = ''
    for (;;) {
      this.skipSpace()
      const ch = this.text[this.pos]
      if (ch === '{') {
        out += this.braced()
      } else if (ch === '"') {
        out += this.quoted()
      } else if (ch !== undefined && /[0-9]/.test(ch)) {
        const m = /^[0-9]+/.exec(this.text.slice(this.pos, this.pos + 20))!
        out += m[0]
        this.pos += m[0].length
      } else if (ch !== undefined && /[A-Za-z_]/.test(ch)) {
        const name = /^[^\s"#%'(),={}]+/.exec(this.text.slice(this.pos, this.pos + 100))![0]
        this.pos += name.length
        const macro = this.macros.get(name.toLowerCase())
        if (macro === undefined) {
          this.warnings.push(`Line ${lineAt(this.text, this.pos)}: undefined macro "${name}"`)
        } else {
          out += macro
        }
      } else {
        this.fail('Expected a value')
      }
      this.skipSpace()
      if (this.text[this.pos] !== '#') return out
      this.pos++
    }
  }

  private fieldName(): string {
    const m = /^[^\s"#%'(),={}]+/.exec(this.text.slice(this.pos, this.pos + 100))
    if (!m) this.fail('Expected a field name')
    this.pos += m[0].length
    return m[0].toLowerCase()
  }

  private expect(ch: string): void {
    this.skipSpace()
    if (this.text[this.pos] !== ch) this.fail(`Expected "${ch}"`)
    this.pos++
  }

  /** Read one `@type{…}` at pos; returns an entry, or null for @string/@comment/@preamble. */
  private entry(): RawEntry | null {
    const start = this.pos
    this.pos++ // @
    this.skipSpace()
    const typeMatch = /^[A-Za-z][\w-]*/.exec(this.text.slice(this.pos, this.pos + 40))
    if (!typeMatch) this.fail('Expected an entry type after @')
    this.pos += typeMatch[0].length
    const type = typeMatch[0].toLowerCase()
    this.skipSpace()
    const open = this.text[this.pos]
    if (open !== '{' && open !== '(') this.fail(`Expected "{" after @${type}`)
    const close = open === '{' ? '}' : ')'

    if (type === 'comment') {
      if (open === '{') this.braced()
      else {
        const end = this.text.indexOf(')', this.pos)
        this.pos = end < 0 ? this.text.length : end + 1
      }
      return null
    }
    this.pos++

    if (type === 'preamble') {
      this.value()
      this.expect(close)
      return null
    }

    if (type === 'string') {
      this.skipSpace()
      const name = this.fieldName()
      this.expect('=')
      this.macros.set(name, this.value())
      this.expect(close)
      return null
    }

    this.skipSpace()
    const keyMatch = /^[^\s,{}()=]*/.exec(this.text.slice(this.pos, this.pos + 400))!
    const key = keyMatch[0]
    this.pos += key.length
    const fields = new Map<string, string>()
    for (;;) {
      this.skipSpace()
      const ch = this.text[this.pos]
      if (ch === close) {
        this.pos++
        break
      }
      if (ch === ',') {
        this.pos++
        continue
      }
      if (ch === undefined) this.fail('Unexpected end of file')
      const name = this.fieldName()
      this.expect('=')
      const value = this.value()
      if (fields.has(name)) {
        this.warnings.push(
          `Line ${lineAt(this.text, this.pos)}: duplicate field "${name}" in ${key}`
        )
      } else {
        fields.set(name, value)
      }
      this.skipSpace()
      const after = this.text[this.pos]
      if (after !== ',' && after !== close) this.fail(`Expected "," or "${close}" after ${name}`)
    }
    return { type, key, fields, pos: start }
  }

  readAll(): RawEntry[] {
    const entries: RawEntry[] = []
    for (;;) {
      const at = this.nextEntry()
      if (at < 0) return entries
      try {
        const entry = this.entry()
        if (entry) entries.push(entry)
      } catch (error) {
        if (!(error instanceof BibSyntaxError)) throw error
        this.warnings.push(
          `Line ${lineAt(this.text, error.pos)}: ${error.message}; skipped the entry starting on line ${lineAt(this.text, at)}`
        )
        // Resume at the next @ that begins a line after the broken entry's start.
        const next = /\n[ \t]*@/g
        next.lastIndex = at + 1
        const m = next.exec(this.text)
        this.pos = m ? m.index + m[0].length - 1 : this.text.length
      }
    }
  }
}

/** Value of a URL-like field: braces and TeX escapes removed, whitespace dropped. */
function verbatim(value: string): string {
  return value
    .replace(/\\url\s*\{([^}]*)\}/g, '$1')
    .replace(/\\([_%&#~$])/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, '')
}

function names(value: string | undefined): CslName[] | undefined {
  if (!value) return undefined
  const list = splitNameList(value)
    .filter((n) => n.toLowerCase() !== 'others')
    .map((n) => parseName(n, decodeLatex))
    .filter((n) => n.family || n.literal)
  return list.length ? list : undefined
}

function issuedDate(fields: Map<string, string>): CslDate | undefined {
  const date = fields.get('date')
  if (date) {
    const parsed = parseDateString(verbatim(date))
    if (parsed) return parsed
  }
  const yearText = decodeLatex(fields.get('year') ?? '')
  if (!yearText) return undefined
  const year = /^(\d{4})/.exec(yearText)
  if (!year) return { literal: yearText }
  const parts = [Number(year[1])]
  const monthText = decodeLatex(fields.get('month') ?? '')
  const month = monthText ? monthFromString(monthText.split(/[\s /.-]/)[0] ?? '') : undefined
  if (month) {
    parts.push(month)
    const day = Number(decodeLatex(fields.get('day') ?? ''))
    if (Number.isInteger(day) && day >= 1 && day <= 31) parts.push(day)
  }
  return { 'date-parts': [parts] }
}

function onlyUrl(fields: Map<string, string>): boolean {
  if (!fields.has('url') && !/\\url|https?:\/\//.test(fields.get('howpublished') ?? ''))
    return false
  const publication = [
    'journal',
    'journaltitle',
    'booktitle',
    'publisher',
    'institution',
    'organization',
    'school',
    'eprint',
    'number',
    'volume',
    'doi',
    'isbn',
  ]
  return !publication.some((f) => fields.has(f))
}

function toItem(entry: RawEntry, warnings: string[]): CslItem {
  const { fields } = entry
  const text = (name: string): string | undefined => {
    const raw = fields.get(name)
    if (raw === undefined) return undefined
    return decodeLatex(raw) || undefined
  }

  let type = TYPE_MAP[entry.type]
  if (entry.type === 'misc') type = onlyUrl(fields) ? 'webpage' : 'article'
  if (!type) {
    warnings.push(`@${entry.type}{${entry.key}}: unknown entry type, imported as a document`)
    type = 'document'
  }

  const item: CslItem = { id: entry.key, type }

  const title = text('title')
  const subtitle = text('subtitle')
  if (title)
    item.title = subtitle ? `${title}${/[?!:.]$/.test(title) ? '' : ':'} ${subtitle}` : title

  const container = text('journal') ?? text('journaltitle') ?? text('booktitle')
  if (container) item['container-title'] = container
  const series = text('series')
  if (series) item['collection-title'] = series

  const author = names(fields.get('author'))
  if (author) item.author = author
  const editor = names(fields.get('editor'))
  if (editor) item.editor = editor
  const translator = names(fields.get('translator'))
  if (translator) item.translator = translator

  const issued = issuedDate(fields)
  if (issued) item.issued = issued
  const urldate = fields.get('urldate')
  if (urldate) {
    const accessed = parseDateString(verbatim(urldate))
    if (accessed) item.accessed = accessed
  }

  const volume = text('volume')
  if (volume) item.volume = volume
  const number = text('number')
  const issue = text('issue')
  if (PERIODICAL_TYPES.has(type)) {
    if (issue ?? number) item.issue = issue ?? number
    if (issue && number) item.number = number
  } else {
    if (number) item.number = number
    if (issue) item.issue = issue
  }
  const pages = fields.get('pages')
  if (pages) {
    const page = decodeLatex(pages.replace(/\s*(?:-{1,3}|–|—)\s*/g, '\u0000')).replace(
      /\u0000/g,
      '-'
    )
    if (page) item.page = page
  }
  const pagetotal = text('pagetotal')
  if (pagetotal) item['number-of-pages'] = pagetotal
  const edition = text('edition')
  if (edition) item.edition = edition

  const publisher =
    text('publisher') ?? text('school') ?? text('institution') ?? text('organization')
  if (publisher) item.publisher = publisher
  const place = text('address') ?? text('location')
  if (place) item['publisher-place'] = place

  const doiRaw = fields.get('doi')
  if (doiRaw) {
    const doi = cleanDoi(verbatim(doiRaw))
    if (doi) item.DOI = doi
    else warnings.push(`@${entry.type}{${entry.key}}: ignored malformed DOI "${verbatim(doiRaw)}"`)
  }
  const url = fields.get('url')
  if (url) item.URL = verbatim(url)

  const howpublished = fields.get('howpublished')
  if (howpublished) {
    const link = /\\url\s*\{([^}]*)\}|(https?:\/\/\S+)/.exec(howpublished)
    if (link) {
      if (!item.URL) item.URL = verbatim(link[1] ?? link[2] ?? '')
    } else if (!item.publisher) {
      const how = decodeLatex(howpublished)
      if (how) item.publisher = how
    }
  }

  const isbn = fields.get('isbn')
  if (isbn) item.ISBN = verbatim(isbn)
  const issn = fields.get('issn')
  if (issn) item.ISSN = verbatim(issn)

  for (const [field, target] of [
    ['note', 'note'],
    ['abstract', 'abstract'],
    ['eventtitle', 'event-title'],
  ] as const) {
    const value = text(field)
    if (value) item[target] = value
  }
  const language = text('langid') ?? text('language')
  if (language) item.language = language

  const genre = text('type')
  if (genre) item.genre = genre
  else if (entry.type === 'phdthesis') item.genre = 'PhD thesis'
  else if (entry.type === 'mastersthesis') item.genre = "Master's thesis"

  // arXiv: eprint + archivePrefix/eprinttype, or Google Scholar's
  // `journal = {arXiv preprint arXiv:2301.01234}`.
  const eprint = fields.get('eprint')
  const archive = verbatim(fields.get('archiveprefix') ?? fields.get('eprinttype') ?? '')
  let arxivId: string | null = null
  if (eprint && (/^arxiv$/i.test(archive) || (!archive && normalizeArxivId(verbatim(eprint))))) {
    arxivId = normalizeArxivId(verbatim(eprint)) ?? verbatim(eprint).replace(/^arxiv:/i, '')
  } else if (container) {
    const scholar = /^arxiv preprint (?:arxiv:)?(\S+)$/i.exec(container)
    if (scholar) {
      arxivId = scholar[1]!
      item.type = 'article'
      item['container-title'] = 'arXiv'
    }
  }
  if (arxivId) {
    item.archive = 'arXiv'
    item.number = `arXiv:${arxivId}`
    if (item.type === 'article-journal' && !item['container-title']) item.type = 'article'
    if (!item.URL) item.URL = `https://arxiv.org/abs/${arxivId}`
  }

  return item
}

/** Parse a BibTeX or BibLaTeX file into CSL items, keeping each entry's key as its id. */
export function parseBibTeX(text: string): ParseResult {
  const warnings: string[] = []
  const entries = new Reader(text.replace(/^﻿/, ''), warnings).readAll()
  const items: CslItem[] = []
  const taken = new Set<string>()
  for (const entry of entries) {
    const item = toItem(entry, warnings)
    if (!item.id) {
      item.id = makeCiteKey(item, taken)
      warnings.push(`Line ${lineAt(text, entry.pos)}: entry without a key, using "${item.id}"`)
    } else if (taken.has(item.id)) {
      const original = item.id
      let n = 2
      while (taken.has(`${original}-${n}`)) n++
      item.id = `${original}-${n}`
      taken.add(item.id)
      warnings.push(`Duplicate key "${original}" renamed to "${item.id}"`)
    } else {
      taken.add(item.id)
    }
    items.push(item)
  }
  return { items, warnings }
}
