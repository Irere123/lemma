import { describe, expect, test } from 'bun:test'

import { normalizeItem, parseCslJson, parseLibrary } from '../../src/citations'

// Shaped like a Zotero "CSL JSON" export plus doi.org's Crossref output.
const ZOTERO = JSON.stringify([
  {
    id: 'http://zotero.org/users/1/items/ABCD1234',
    type: 'article-journal',
    title: '  The deep learning\n revolution ',
    'container-title': ['Journal of Machine Learning Research', 'J. Mach. Learn. Res.'],
    author: [
      { family: 'Smith', given: 'John', sequence: 'first', affiliation: [{ name: 'MIT' }] },
      { literal: 'The ML Consortium' },
      { given: '' },
    ],
    issued: { 'date-parts': [['2020', '3', 15]] },
    volume: 12,
    issue: '3',
    page: '45-67',
    DOI: 'https://doi.org/10.1000/JMLR.2020.123',
    reference: [{ key: 'ref1' }],
    license: [{ URL: 'https://creativecommons.org/licenses/by/4.0/' }],
    link: [{ URL: 'https://example.org/pdf' }],
    'content-domain': { domain: [] },
    'reference-count': 42,
  },
  {
    id: 7,
    type: 'book',
    title: 'Numbered id',
    issued: { raw: 'March 2001' },
  },
  { type: 'chapter', title: 'No id here', author: [{ family: 'Brown', given: 'Alice' }] },
  { id: 'dup', type: 'webpage', title: 'First' },
  { id: 'dup', type: 'webpage', title: 'Second' },
  'not an item',
  { id: 'odd', type: 'journal-article', title: 'Crossref type name' },
])

describe('normalizeItem', () => {
  test('coerces, trims, and drops heavy or unknown fields', () => {
    const item = normalizeItem(JSON.parse(ZOTERO)[0])
    expect(item).toEqual({
      id: 'http://zotero.org/users/1/items/ABCD1234',
      type: 'article-journal',
      title: 'The deep learning revolution',
      'container-title': 'Journal of Machine Learning Research',
      author: [{ family: 'Smith', given: 'John' }, { literal: 'The ML Consortium' }],
      issued: { 'date-parts': [[2020, 3, 15]] },
      volume: '12',
      issue: '3',
      page: '45-67',
      DOI: '10.1000/JMLR.2020.123',
    })
  })

  test('drops CSL rich-text tags from titles but keeps other angle brackets', () => {
    expect(
      normalizeItem({
        title: 'Growth of <i>E. coli</i> at <span class="nocase">pH</span> 7 (x<sup>2</sup>)',
      }).title
    ).toBe('Growth of E. coli at pH 7 (x2)')
    expect(normalizeItem({ title: 'When a < b and c > d' }).title).toBe('When a < b and c > d')
  })

  test('unknown types become "document"; raw dates are parsed', () => {
    expect(normalizeItem({ type: 'hologram' }).type).toBe('document')
    expect(normalizeItem({ issued: { raw: 'March 2001' } }).issued).toEqual({
      raw: 'March 2001',
      'date-parts': [[2001, 3]],
    })
    expect(normalizeItem(null)).toEqual({ id: '', type: 'document' })
  })
})

describe('parseCslJson', () => {
  test('normalises items and makes ids unique', () => {
    const { items, warnings } = parseCslJson(ZOTERO)
    expect(items.map((i) => [i.id, i.type])).toEqual([
      ['http://zotero.org/users/1/items/ABCD1234', 'article-journal'],
      ['7', 'book'],
      ['brownid', 'chapter'],
      ['dup', 'webpage'],
      ['second', 'webpage'],
      ['odd', 'article-journal'],
    ])
    expect(warnings).toEqual([
      'Item 3: missing id, using "brownid"',
      'Item 5: duplicate id "dup" renamed to "second"',
      'Item 6: not an object, skipped',
    ])
  })

  test('accepts { items: [...] } and a single item', () => {
    expect(parseCslJson('{"items":[{"id":"a","type":"book","title":"A"}]}').items).toHaveLength(1)
    expect(parseCslJson('{"id":"b","type":"book","title":"B"}').items[0]!.id).toBe('b')
  })

  test('reports invalid JSON instead of throwing', () => {
    const result = parseCslJson('[{"id": ')
    expect(result.items).toEqual([])
    expect(result.warnings[0]).toStartWith('Invalid JSON')
  })
})

describe('parseLibrary', () => {
  const bib = '@book{knuth, title = {TAOCP}, year = 1997}'
  const ris = 'TY  - BOOK\nTI  - TAOCP\nER  - \n'
  const json = '[{"id":"knuth","type":"book","title":"TAOCP"}]'

  test('detects the format from the extension', () => {
    expect(parseLibrary(bib, 'My Library.bib').format).toBe('bibtex')
    expect(parseLibrary(ris, 'export.RIS').format).toBe('ris')
    expect(parseLibrary(json, 'items.json').format).toBe('csl-json')
  })

  test('sniffs the content otherwise', () => {
    for (const [text, format] of [
      [bib, 'bibtex'],
      [`﻿${ris}`, 'ris'],
      [`  ${json}`, 'csl-json'],
    ] as const) {
      const result = parseLibrary(text, 'download.txt')
      expect(result.format).toBe(format)
      expect(result.items[0]!.title).toBe('TAOCP')
    }
  })

  test('unknown content yields no items and a warning', () => {
    const result = parseLibrary('just some notes')
    expect(result).toMatchObject({ format: 'unknown', items: [] })
    expect(result.warnings).toHaveLength(1)
  })
})
