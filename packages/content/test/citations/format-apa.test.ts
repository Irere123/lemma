import { describe, expect, test } from 'bun:test'

import { type CslItem, createCitationProcessor } from '../../src/citations'
import {
  article,
  book,
  chapter,
  citeText,
  entryFor,
  LIBRARY,
  one,
  preprint,
  report,
  thesis,
  webpage,
} from './fixtures'

const smith = (id: string, title: string, year?: number, given = 'John'): CslItem => ({
  id,
  type: 'article-journal',
  title,
  'container-title': 'Journal of Tests',
  author: [{ family: 'Smith', given }],
  ...(year ? { issued: { 'date-parts': [[year]] } } : {}),
})

describe('APA 7 reference list', () => {
  test('journal article', () => {
    expect(entryFor('apa', article)).toEqual({
      text: 'Smith, J., Jones, J., & Lee, K. (2020). The deep learning revolution. Journal of Machine Learning Research, 12(3), 45–67. https://doi.org/10.1000/jmlr.2020.123',
      html: 'Smith, J., Jones, J., &amp; Lee, K. (2020). The deep learning revolution. <i>Journal of Machine Learning Research</i>, <i>12</i>(3), 45–67. https://doi.org/10.1000/jmlr.2020.123',
    })
  })

  test('book with edition', () => {
    expect(entryFor('apa', book)).toEqual({
      text: 'Knuth, D. E. (1997). The art of computer programming (3rd ed.). Addison-Wesley.',
      html: 'Knuth, D. E. (1997). <i>The art of computer programming</i> (3rd ed.). Addison-Wesley.',
    })
  })

  test('chapter in an edited book', () => {
    expect(entryFor('apa', chapter)).toEqual({
      text: 'Brown, A. (2018). Neural networks in practice. In P. Green & S. White (Eds.), Handbook of artificial intelligence (pp. 101–125). Springer. https://doi.org/10.1007/978-3-319-00000-0_5',
      html: 'Brown, A. (2018). Neural networks in practice. In P. Green &amp; S. White (Eds.), <i>Handbook of artificial intelligence</i> (pp. 101–125). Springer. https://doi.org/10.1007/978-3-319-00000-0_5',
    })
  })

  test('report by a group author omits the same publisher', () => {
    expect(entryFor('apa', report).text).toBe(
      'World Health Organization. (2021). Global report on infection prevention and control (Report No. 12). https://www.who.int/publications/i/item/9789240051164'
    )
  })

  test('doctoral dissertation', () => {
    expect(entryFor('apa', thesis)).toEqual({
      text: 'Garcia, M. (2019). Learning to see in the dark [Doctoral dissertation, Stanford University]. https://purl.stanford.edu/abc123',
      html: 'Garcia, M. (2019). <i>Learning to see in the dark</i> [Doctoral dissertation, Stanford University]. https://purl.stanford.edu/abc123',
    })
  })

  test("master's thesis from a database", () => {
    const masters = {
      ...thesis,
      genre: "Master's thesis",
      archive: 'ProQuest Dissertations and Theses Global',
      URL: undefined,
    }
    expect(entryFor('apa', masters).text).toBe(
      "Garcia, M. (2019). Learning to see in the dark [Master's thesis, Stanford University]. ProQuest Dissertations and Theses Global."
    )
  })

  test('webpage with a full date and site name', () => {
    expect(entryFor('apa', webpage)).toEqual({
      text: 'Doe, J. (2023, May 14). How transformers work. The Gradient. https://thegradient.pub/transformers',
      html: 'Doe, J. (2023, May 14). <i>How transformers work</i>. The Gradient. https://thegradient.pub/transformers',
    })
  })

  test('undated webpage gets n.d. and a retrieval date', () => {
    const page: CslItem = {
      id: 'page',
      type: 'webpage',
      title: 'Style guide',
      'container-title': 'Example Org',
      URL: 'https://example.org/style',
      accessed: { 'date-parts': [[2024, 2, 3]] },
    }
    expect(entryFor('apa', page).text).toBe(
      'Style guide. (n.d.). Example Org. Retrieved February 3, 2024, from https://example.org/style'
    )
  })

  test('arXiv preprint', () => {
    expect(entryFor('apa', preprint)).toEqual({
      text: 'Vaswani, A., & Shazeer, N. (2017). Attention is all you need (arXiv:1706.03762). arXiv. https://doi.org/10.48550/arXiv.1706.03762',
      html: 'Vaswani, A., &amp; Shazeer, N. (2017). <i>Attention is all you need</i> (arXiv:1706.03762). arXiv. https://doi.org/10.48550/arXiv.1706.03762',
    })
  })

  test('edited book: editors take the author position', () => {
    const edited: CslItem = {
      id: 'ed',
      type: 'book',
      title: 'Handbook of research methods',
      editor: [
        { family: 'Green', given: 'Peter' },
        { family: 'White', given: 'Sarah' },
      ],
      issued: { 'date-parts': [[2015]] },
      publisher: 'Sage',
    }
    expect(entryFor('apa', edited).text).toBe(
      'Green, P., & White, S. (Eds.). (2015). Handbook of research methods. Sage.'
    )
  })

  test('no author: the title moves to the front', () => {
    const anonymous: CslItem = {
      id: 'dict',
      type: 'book',
      title: 'Merriam-Webster’s collegiate dictionary',
      issued: { 'date-parts': [[2003]] },
      edition: '11',
      publisher: 'Merriam-Webster',
    }
    expect(entryFor('apa', anonymous).text).toBe(
      'Merriam-Webster’s collegiate dictionary (11th ed.). (2003). Merriam-Webster.'
    )
  })

  test('21 or more authors: first 19, an ellipsis, then the last', () => {
    const big: CslItem = {
      id: 'big',
      type: 'article-journal',
      title: 'Team science',
      'container-title': 'Nature',
      author: Array.from({ length: 22 }, (_, i) => ({ family: `Author${i + 1}`, given: 'Alex' })),
      issued: { 'date-parts': [[2021]] },
    }
    const text = entryFor('apa', big).text
    expect(text).toStartWith('Author1, A., Author2, A., ')
    expect(text).toContain('Author19, A., . . . Author22, A. (2021).')
    expect(text).not.toContain('Author20')
  })

  test('names with particles and suffixes', () => {
    const item: CslItem = {
      id: 'p',
      type: 'book',
      title: 'Particles',
      author: [
        { family: 'Berg', 'non-dropping-particle': 'van den', given: 'Jan Pieter' },
        { family: 'King', given: 'Martin Luther', suffix: 'Jr.' },
        { family: 'Sartre', given: 'Jean-Paul' },
      ],
      issued: { 'date-parts': [[2000]] },
      publisher: 'P',
    }
    expect(entryFor('apa', item).text).toBe(
      'van den Berg, J. P., King, M. L., Jr., & Sartre, J.-P. (2000). Particles. P.'
    )
  })

  test('titles ending in a question mark take no extra period', () => {
    const q = { ...article, title: 'Is attention all you need?' }
    expect(entryFor('apa', q).text).toContain('(2020). Is attention all you need? Journal of')
  })

  test('sorted alphabetically, undated works first for the same author', () => {
    const items = [
      smith('b', 'Later', 2021),
      smith('a', 'Undated'),
      { ...book },
      smith('c', 'Earlier', 2019),
    ]
    const result = createCitationProcessor('apa', items).process(items.map((i) => one(i.id)))
    expect(result.bibliography.map((e) => e.id)).toEqual(['knuth1997art', 'a', 'c', 'b'])
  })
})

describe('APA 7 in-text citations', () => {
  test('one, two, and three or more authors', () => {
    expect(
      citeText('apa', LIBRARY, [
        one('knuth1997art'),
        one('vaswani2017attention'),
        one('smith2020deep'),
      ])
    ).toEqual(['(Knuth, 1997)', '(Vaswani & Shazeer, 2017)', '(Smith et al., 2020)'])
  })

  test('narrative citations use "and"', () => {
    expect(
      citeText('apa', LIBRARY, [
        { items: [{ id: 'vaswani2017attention' }], mode: 'author-in-text' },
        { items: [{ id: 'smith2020deep', locator: '4' }], mode: 'author-in-text' },
      ])
    ).toEqual(['Vaswani and Shazeer (2017)', 'Smith et al. (2020, p. 4)'])
  })

  test('locators', () => {
    expect(
      citeText('apa', LIBRARY, [
        one('knuth1997art', { locator: '4' }),
        one('knuth1997art', { locator: '4-5' }),
        one('knuth1997art', { locator: '4--5' }),
        one('knuth1997art', { locator: '3', label: 'chapter' }),
        one('knuth1997art', { locator: '2', label: 'paragraph' }),
        one('knuth1997art', { locator: '1', label: 'figure' }),
      ])
    ).toEqual([
      '(Knuth, 1997, p. 4)',
      '(Knuth, 1997, pp. 4–5)',
      '(Knuth, 1997, pp. 4–5)',
      '(Knuth, 1997, Chapter 3)',
      '(Knuth, 1997, para. 2)',
      '(Knuth, 1997, Figure 1)',
    ])
  })

  test('several works in one citation are ordered as in the reference list', () => {
    expect(
      citeText('apa', LIBRARY, [
        {
          items: [
            { id: 'smith2020deep' },
            { id: 'knuth1997art', locator: '12' },
            { id: 'brown2018neural' },
          ],
        },
      ])
    ).toEqual(['(Brown, 2018; Knuth, 1997, p. 12; Smith et al., 2020)'])
  })

  test('same author and year: a/b in text and in the reference list', () => {
    const items = [
      smith('beta', 'Beta study', 2020),
      smith('alpha', 'Alpha study', 2020),
      smith('old', 'Old', 2018),
    ]
    const result = createCitationProcessor('apa', items).process([
      one('beta'),
      one('alpha'),
      { items: [{ id: 'beta' }, { id: 'old' }, { id: 'alpha' }] },
    ])
    expect(result.clusters.map((c) => c.text)).toEqual([
      '(Smith, 2020b)',
      '(Smith, 2020a)',
      '(Smith, 2018, 2020a, 2020b)',
    ])
    expect(result.bibliography.map((e) => e.text)).toEqual([
      'Smith, J. (2018). Old. Journal of Tests.',
      'Smith, J. (2020a). Alpha study. Journal of Tests.',
      'Smith, J. (2020b). Beta study. Journal of Tests.',
    ])
  })

  test('undated works by the same author: n.d.-a, n.d.-b', () => {
    const items = [smith('x', 'Xylophones'), smith('w', 'Whistles')]
    expect(citeText('apa', items, [one('x'), one('w')])).toEqual([
      '(Smith, n.d.-b)',
      '(Smith, n.d.-a)',
    ])
  })

  test('different first authors with the same surname get initials', () => {
    const items = [smith('j', 'One', 2020, 'John'), smith('a', 'Two', 2019, 'Anna')]
    expect(citeText('apa', items, [one('j'), one('a')])).toEqual([
      '(J. Smith, 2020)',
      '(A. Smith, 2019)',
    ])
  })

  test('no author: italic title for books, quoted title for articles', () => {
    const bookNoAuthor: CslItem = {
      id: 'b',
      type: 'book',
      title: 'College bound',
      issued: { 'date-parts': [[2008]] },
    }
    const articleNoAuthor: CslItem = {
      id: 'a',
      type: 'article-journal',
      title: 'Study finds',
      issued: { 'date-parts': [[2020]] },
    }
    const result = createCitationProcessor('apa', [bookNoAuthor, articleNoAuthor]).process([
      one('b'),
      one('a', { locator: '3' }),
      { items: [{ id: 'a' }], mode: 'author-in-text' },
    ])
    expect(result.clusters).toEqual([
      { text: '(College bound, 2008)', html: '(<i>College bound</i>, 2008)' },
      { text: '(“Study finds,” 2020, p. 3)', html: '(“Study finds,” 2020, p. 3)' },
      { text: '“Study finds” (2020)', html: '“Study finds” (2020)' },
    ])
  })

  test('missing date renders n.d.', () => {
    expect(citeText('apa', [smith('s', 'Undated')], [one('s')])).toEqual(['(Smith, n.d.)'])
  })

  test('suppress-author, prefix and suffix', () => {
    expect(
      citeText('apa', LIBRARY, [
        { items: [{ id: 'knuth1997art' }], mode: 'suppress-author' },
        one('knuth1997art', { prefix: 'see', locator: '7', suffix: 'for an overview' }),
        one('knuth1997art', { prefix: 'e.g.,', suffix: ', esp. ch. 2' }),
      ])
    ).toEqual([
      '(1997)',
      '(see Knuth, 1997, p. 7, for an overview)',
      '(e.g., Knuth, 1997, esp. ch. 2)',
    ])
  })
})
