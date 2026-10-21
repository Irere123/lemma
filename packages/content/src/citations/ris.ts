import { makeCiteKey } from './citekey'
import type { CslItem, CslName, CslType, ParseResult } from './csl'
import { parseDateString } from './dates'
import { cleanDoi } from './identifiers'
import { parseName } from './names'

// RIS (Research Information Systems) as exported by Zotero, EndNote,
// Mendeley and most publisher sites: `TAG  - value` lines, ER ends a record.

const TYPE_MAP: Record<string, CslType> = {
  JOUR: 'article-journal',
  JFULL: 'article-journal',
  EJOUR: 'article-journal',
  ABST: 'article-journal',
  INPR: 'article-journal',
  MGZN: 'article-magazine',
  NEWS: 'article-newspaper',
  BOOK: 'book',
  EBOOK: 'book',
  EDBOOK: 'book',
  WHOLE: 'book',
  SER: 'book',
  CHAP: 'chapter',
  ECHAP: 'chapter',
  CONF: 'paper-conference',
  CPAPER: 'paper-conference',
  RPRT: 'report',
  GOVDOC: 'report',
  THES: 'thesis',
  ELEC: 'webpage',
  WEB: 'webpage',
  BLOG: 'post-weblog',
  DATA: 'dataset',
  DBASE: 'dataset',
  COMP: 'software',
  UNPB: 'manuscript',
  MANSCPT: 'manuscript',
  PAT: 'patent',
  STAND: 'standard',
  MPCT: 'motion_picture',
  VIDEO: 'motion_picture',
  ENCYC: 'entry-encyclopedia',
  DICT: 'entry-dictionary',
  PCOMM: 'personal_communication',
  ICOMM: 'personal_communication',
  MAP: 'map',
  PAMP: 'pamphlet',
  GEN: 'document',
}

const BOOK_LIKE = new Set<CslType>(['book', 'chapter', 'paper-conference', 'report', 'thesis'])

const LINE = /^([A-Z][A-Z0-9]) {1,2}-(?: (.*))?$/

type Record_ = { fields: Map<string, string[]>; line: number }

function first(record: Record_, ...tags: string[]): string | undefined {
  for (const tag of tags) {
    const value = record.fields.get(tag)?.find((v) => v.trim())
    if (value) return value.trim()
  }
  return undefined
}

// RIS writes people as "Last, First[, Suffix]"; a name without a comma is an
// institution ("World Health Organization") or a mononym, kept as written.
function nameList(record: Record_, ...tags: string[]): CslName[] | undefined {
  const names: CslName[] = []
  for (const tag of tags) {
    for (const value of record.fields.get(tag) ?? []) {
      const text = value.trim()
      const name = text.includes(',') ? parseName(text) : { literal: text }
      if (name.family || name.literal) names.push(name)
    }
  }
  return names.length ? names : undefined
}

function toItem(record: Record_, warnings: string[]): CslItem {
  const ty = first(record, 'TY')?.toUpperCase() ?? ''
  let type = TYPE_MAP[ty]
  if (!type) {
    warnings.push(`Line ${record.line}: unknown RIS type "${ty}", imported as a document`)
    type = 'document'
  }
  const item: CslItem = { id: '', type }

  const title = first(record, 'TI', 'T1', 'CT')
  const bt = first(record, 'BT')
  // Some exporters put a book's own title in BT.
  if (title) item.title = title
  else if (bt && (type === 'book' || type === 'report')) item.title = bt

  const container = type === 'book' ? undefined : first(record, 'JF', 'JO', 'T2', 'BT', 'JA', 'J2')
  if (container) item['container-title'] = container
  const series = first(record, 'T3')
  if (series) item['collection-title'] = series

  const author = nameList(record, 'AU', 'A1')
  if (author) item.author = author
  const editor = nameList(record, 'ED', 'A2')
  if (editor) item.editor = editor
  const translator = nameList(record, 'TA')
  if (translator) item.translator = translator

  // DA is usually the most precise date; PY/Y1 are "YYYY/MM/DD/other".
  const py = first(record, 'PY', 'Y1')
  const da = first(record, 'DA')
  const pyDate = py ? parseDateString(py) : undefined
  const daDate = da ? parseDateString(da) : undefined
  const pyParts = pyDate?.['date-parts']?.[0]
  const daParts = daDate?.['date-parts']?.[0]
  const issued =
    daParts && (!pyParts || (daParts[0] === pyParts[0] && daParts.length > pyParts.length))
      ? daDate
      : (pyDate ?? daDate)
  if (issued) item.issued = issued
  const y2 = first(record, 'Y2')
  const accessed = y2 ? parseDateString(y2) : undefined
  if (accessed?.['date-parts']) item.accessed = accessed

  const volume = first(record, 'VL')
  if (volume) item.volume = volume
  const issue = first(record, 'IS')
  if (issue) {
    if (type === 'report') item.number = issue
    else item.issue = issue
  }
  const sp = first(record, 'SP')
  const ep = first(record, 'EP')
  if (sp)
    item.page = ep && !/[-–]/.test(sp) && ep !== sp ? `${sp}-${ep}` : sp.replace(/\s*[–—]\s*/g, '-')

  const doiRaw = first(record, 'DO')
  if (doiRaw) {
    const doi = cleanDoi(doiRaw)
    if (doi) item.DOI = doi
  }
  const url = first(record, 'UR', 'L2')
  if (url) {
    const link = url.split(/\s+/)[0]!
    // Some exporters put the DOI only in UR.
    const doi = item.DOI ? null : cleanDoi(link)
    if (doi && /doi\.org\//i.test(link)) item.DOI = doi
    else item.URL = link
  }
  const sn = first(record, 'SN')
  if (sn) {
    const value = sn.split(/[\s;,]+/)[0]!
    if (BOOK_LIKE.has(type) || value.replace(/[^\dXx]/g, '').length > 8) item.ISBN = value
    else item.ISSN = value
  }

  const simple = [
    ['PB', 'publisher'],
    ['CY', 'publisher-place'],
    ['ET', 'edition'],
    ['N1', 'note'],
    ['LA', 'language'],
    ['M3', 'genre'],
  ] as const
  for (const [tag, field] of simple) {
    const value = first(record, tag)
    if (value) item[field] = value
  }
  const abstract = first(record, 'AB', 'N2')
  if (abstract) item.abstract = abstract
  if (type === 'thesis' && !item.genre) {
    const kind = first(record, 'M1')
    if (kind) item.genre = kind
  }
  return item
}

/** Parse an RIS file; ids are generated with `makeCiteKey`. */
export function parseRIS(text: string): ParseResult {
  const warnings: string[] = []
  const records: Record_[] = []
  let current: Record_ | null = null
  let lastTag = ''
  const lines = text.replace(/^﻿/, '').split(/\r\n?|\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const m = LINE.exec(line.trimEnd())
    if (!m) {
      // Continuation of a wrapped value (long abstracts and notes).
      if (current && lastTag && line.trim()) {
        const values = current.fields.get(lastTag)!
        values[values.length - 1] = `${values.at(-1)} ${line.trim()}`
      }
      continue
    }
    const tag = m[1]!
    const value = (m[2] ?? '').trim()
    if (tag === 'TY') {
      if (current) {
        warnings.push(`Line ${current.line}: record without ER`)
        records.push(current)
      }
      current = { fields: new Map(), line: i + 1 }
    } else if (!current) {
      continue
    }
    if (tag === 'ER') {
      records.push(current)
      current = null
      lastTag = ''
      continue
    }
    const values = current.fields.get(tag)
    if (values) values.push(value)
    else current.fields.set(tag, [value])
    lastTag = tag
  }
  if (current) {
    warnings.push(`Line ${current.line}: record without ER`)
    records.push(current)
  }

  const taken = new Set<string>()
  const items = records.map((record) => {
    const item = toItem(record, warnings)
    item.id = makeCiteKey(item, taken)
    return item
  })
  return { items, warnings }
}
