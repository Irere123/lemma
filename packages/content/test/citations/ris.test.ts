import { describe, expect, test } from 'bun:test'

import { parseRIS } from '../../src/citations'

// Shaped like Zotero's and EndNote's RIS exports (CRLF line endings included).
const SAMPLE = [
  'TY  - JOUR',
  'TI  - The deep learning revolution',
  'AU  - Smith, John',
  'AU  - Jones, Jane',
  'T2  - Journal of Machine Learning Research',
  'JA  - J. Mach. Learn. Res.',
  'DA  - 2020/03/15',
  'PY  - 2020',
  'VL  - 12',
  'IS  - 3',
  'SP  - 45',
  'EP  - 67',
  'DO  - 10.1000/jmlr.2020.123',
  'SN  - 1532-4435',
  'UR  - https://jmlr.org/papers/v12/smith20a.html',
  'AB  - We show that deep learning',
  '      changes everything.',
  'KW  - deep learning',
  'ER  - ',
  '',
  'TY  - BOOK',
  'TI  - The art of computer programming',
  'A1  - Knuth, Donald E.',
  'PY  - 1997///',
  'CY  - Reading, MA',
  'PB  - Addison-Wesley',
  'ET  - 3',
  'SN  - 978-0-201-89683-1',
  'ER  - ',
  '',
  'TY  - CHAP',
  'TI  - Neural networks in practice',
  'AU  - Brown, Alice',
  'ED  - Green, Peter',
  'A2  - White, Sarah',
  'BT  - Handbook of artificial intelligence',
  'PY  - 2018',
  'SP  - 101-125',
  'PB  - Springer',
  'ER  - ',
  '',
  'TY  - CPAPER',
  'T1  - Fast training',
  'AU  - He, Kaiming',
  'T2  - Proceedings of CVPR',
  'Y1  - 2016/06/27/',
  'ER  - ',
  '',
  'TY  - THES',
  'TI  - Learning to see in the dark',
  'AU  - García, María',
  'PY  - 2019',
  'PB  - Stanford University',
  'M3  - PhD thesis',
  'ER  - ',
  '',
  'TY  - RPRT',
  'TI  - Global report',
  'AU  - World Health Organization',
  'PY  - 2021',
  'IS  - 12',
  'PB  - WHO',
  'ER  - ',
  '',
  'TY  - ELEC',
  'TI  - How transformers work',
  'AU  - Doe, Jane',
  'PY  - 2023',
  'DA  - 2023/05/14',
  'Y2  - 2024/01/10',
  'UR  - https://thegradient.pub/transformers',
  'ER  - ',
  '',
  'TY  - DATA',
  'TI  - Global temperatures',
  'AU  - Rohde, Robert',
  'PY  - 2020',
  'UR  - https://doi.org/10.5281/zenodo.123456',
  'ER  - ',
  '',
  'TY  - GEN',
  'TI  - Something generic',
  'ER  - ',
].join('\r\n')

describe('parseRIS', () => {
  const { items, warnings } = parseRIS(SAMPLE)

  test('maps record types and generates cite keys', () => {
    expect(warnings).toEqual([])
    expect(items.map((i) => [i.id, i.type])).toEqual([
      ['smith2020deep', 'article-journal'],
      ['knuth1997art', 'book'],
      ['brown2018neural', 'chapter'],
      ['he2016fast', 'paper-conference'],
      ['garcia2019learning', 'thesis'],
      ['world2021global', 'report'],
      ['doe2023transformers', 'webpage'],
      ['rohde2020global', 'dataset'],
      ['somethinggeneric', 'document'],
    ])
  })

  test('journal article fields, including a wrapped abstract', () => {
    expect(items[0]).toEqual({
      id: 'smith2020deep',
      type: 'article-journal',
      title: 'The deep learning revolution',
      'container-title': 'Journal of Machine Learning Research',
      author: [
        { family: 'Smith', given: 'John' },
        { family: 'Jones', given: 'Jane' },
      ],
      issued: { 'date-parts': [[2020, 3, 15]] },
      volume: '12',
      issue: '3',
      page: '45-67',
      DOI: '10.1000/jmlr.2020.123',
      URL: 'https://jmlr.org/papers/v12/smith20a.html',
      ISSN: '1532-4435',
      abstract: 'We show that deep learning changes everything.',
    })
  })

  test('books, chapters, conference papers and theses', () => {
    expect(items[1]).toMatchObject({
      author: [{ family: 'Knuth', given: 'Donald E.' }],
      issued: { 'date-parts': [[1997]] },
      'publisher-place': 'Reading, MA',
      publisher: 'Addison-Wesley',
      edition: '3',
      ISBN: '978-0-201-89683-1',
    })
    expect(items[2]).toMatchObject({
      'container-title': 'Handbook of artificial intelligence',
      editor: [
        { family: 'Green', given: 'Peter' },
        { family: 'White', given: 'Sarah' },
      ],
      page: '101-125',
    })
    expect(items[3]).toMatchObject({
      'container-title': 'Proceedings of CVPR',
      issued: { 'date-parts': [[2016, 6, 27]] },
    })
    expect(items[4]).toMatchObject({ genre: 'PhD thesis', publisher: 'Stanford University' })
  })

  test('reports keep IS as the report number; web pages keep the access date', () => {
    expect(items[5]).toMatchObject({
      author: [{ literal: 'World Health Organization' }],
      number: '12',
      publisher: 'WHO',
    })
    expect(items[6]).toMatchObject({
      issued: { 'date-parts': [[2023, 5, 14]] },
      accessed: { 'date-parts': [[2024, 1, 10]] },
      URL: 'https://thegradient.pub/transformers',
    })
    // A doi.org address in UR becomes the DOI.
    expect(items[7]).toMatchObject({ DOI: '10.5281/zenodo.123456' })
    expect(items[7]!.URL).toBeUndefined()
  })

  test('tolerates a missing ER and unknown types, with warnings', () => {
    const result = parseRIS('TY  - ZZZZ\nTI  - First\nTY  - JOUR\nTI  - Second\nPY  - 2001\n')
    expect(result.items.map((i) => [i.type, i.title])).toEqual([
      ['document', 'First'],
      ['article-journal', 'Second'],
    ])
    expect(result.warnings).toHaveLength(3)
  })

  test('duplicate generated keys get suffixes', () => {
    const record = 'TY  - JOUR\nAU  - Smith, J.\nTI  - Same title\nPY  - 2020\nER  - \n'
    expect(parseRIS(record + record + record).items.map((i) => i.id)).toEqual([
      'smith2020same',
      'smith2020samea',
      'smith2020sameb',
    ])
  })
})
