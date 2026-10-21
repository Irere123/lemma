import { describe, expect, test } from 'bun:test'

import {
  type CslItem,
  createCitationProcessor,
  parseBibTeX,
  STYLES,
  toBibTeX,
  toBibTeXKey,
} from '../../src/citations'
import { article, LIBRARY } from './fixtures'

describe('toBibTeX', () => {
  test('writes a journal article', () => {
    expect(toBibTeX([article])).toBe(
      [
        '@article{smith2020deep,',
        '  author = {Smith, John and Jones, Jane and Lee, Kim},',
        '  title = {The deep learning revolution},',
        '  journal = {Journal of Machine Learning Research},',
        '  year = {2020},',
        '  month = mar,',
        '  volume = {12},',
        '  number = {3},',
        '  pages = {45--67},',
        '  doi = {10.1000/jmlr.2020.123}',
        '}',
        '',
      ].join('\n')
    )
  })

  test('maps types, theses, preprints and web pages', () => {
    const bib = toBibTeX(LIBRARY)
    expect(bib).toContain('@book{knuth1997art,')
    expect(bib).toContain('@incollection{brown2018neural,')
    expect(bib).toContain('  booktitle = {Handbook of artificial intelligence},')
    expect(bib).toContain('@techreport{who2021global,')
    expect(bib).toContain('  author = {{World Health Organization}},')
    expect(bib).toContain('  institution = {World Health Organization},')
    expect(bib).toContain('@phdthesis{garcia2019learning,')
    expect(bib).toContain('  school = {Stanford University},')
    expect(bib).toContain('@online{doe2023how,')
    expect(bib).toContain('  date = {2023-05-14},')
    expect(bib).toContain('  urldate = {2024-01-10}\n}')
    expect(bib).toContain('@misc{vaswani2017attention,')
    expect(bib).toContain('  eprint = {1706.03762},\n  archiveprefix = {arXiv},')
    expect(bib).not.toMatch(/number = \{arXiv/)
  })

  test("escapes TeX specials and protects capitalised words from Pandoc's sentence casing", () => {
    const item: CslItem = {
      id: 'x',
      type: 'article-journal',
      title: 'DNA & iPhone: 50% of $5 #1 under_score {braces} ~tilde^ back\\slash',
      author: [
        { family: 'Berg', 'non-dropping-particle': 'van den', given: 'Jan' },
        { family: 'King', given: 'Martin Luther', suffix: 'Jr.' },
        { literal: 'Barnes & Noble' },
      ],
      URL: 'https://example.org/a_b?c=1%202&d#e',
    }
    const bib = toBibTeX([item])
    expect(bib).toContain(
      'title = {{DNA} \\& {iPhone:} 50\\% of \\$5 \\#1 under\\_score \\{braces\\} \\textasciitilde{}tilde\\textasciicircum{} back\\textbackslash{}slash}'
    )
    expect(bib).toContain(
      'author = {van den Berg, Jan and King, Jr., Martin Luther and {Barnes \\& Noble}}'
    )
    expect(bib).toContain('url = {https://example.org/a_b?c=1%202&d#e}')
    // …and our own reader gets the original values back.
    const [parsed] = parseBibTeX(bib).items
    expect(parsed!.title).toBe(item.title)
    expect(parsed!.author).toEqual(item.author)
    expect(parsed!.URL).toBe(item.URL)
  })

  test('keys are safe for BibTeX and [@key]', () => {
    expect(toBibTeXKey('smith2020deep')).toBe('smith2020deep')
    expect(toBibTeXKey('http://zotero.org/users/1/items/AB')).toBe(
      'http://zotero.org/users/1/items/AB'
    )
    expect(toBibTeXKey('my key, {x}')).toBe('my_key___x_')
    expect(toBibTeXKey('  ')).toBe('ref')
    expect(toBibTeX([])).toBe('')
  })

  test.each(
    STYLES.map((s) => s.id)
  )('round trip through BibTeX formats identically in %s', (style) => {
    const clusters = LIBRARY.map((item) => ({ items: [{ id: item.id }] }))
    const before = createCitationProcessor(style, LIBRARY).process(clusters)
    const { items, warnings } = parseBibTeX(toBibTeX(LIBRARY))
    expect(warnings).toEqual([])
    const after = createCitationProcessor(style, items).process(clusters)
    expect(after.bibliography).toEqual(before.bibliography)
    expect(after.clusters).toEqual(before.clusters)
  })
})
