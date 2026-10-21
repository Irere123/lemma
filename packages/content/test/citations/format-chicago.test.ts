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

describe('Chicago author-date reference list', () => {
  test('journal article (two authors, as in CMOS 15.9)', () => {
    const twoAuthors = { ...article, author: article.author!.slice(0, 2) }
    expect(entryFor('chicago', twoAuthors)).toEqual({
      text: 'Smith, John, and Jane Jones. 2020. “The deep learning revolution.” Journal of Machine Learning Research 12 (3): 45–67. https://doi.org/10.1000/jmlr.2020.123.',
      html: 'Smith, John, and Jane Jones. 2020. “The deep learning revolution.” <i>Journal of Machine Learning Research</i> 12 (3): 45–67. https://doi.org/10.1000/jmlr.2020.123.',
    })
  })

  test('journal article with three authors', () => {
    expect(entryFor('chicago', article).text).toStartWith(
      'Smith, John, Jane Jones, and Kim Lee. 2020.'
    )
  })

  test('book with edition and place', () => {
    expect(entryFor('chicago', book)).toEqual({
      text: 'Knuth, Donald E. 1997. The art of computer programming. 3rd ed. Reading, MA: Addison-Wesley.',
      html: 'Knuth, Donald E. 1997. <i>The art of computer programming</i>. 3rd ed. Reading, MA: Addison-Wesley.',
    })
  })

  test('chapter: "edited by" and shortened page range', () => {
    expect(entryFor('chicago', chapter)).toEqual({
      text: 'Brown, Alice. 2018. “Neural networks in practice.” In Handbook of artificial intelligence, edited by Peter Green and Sarah White, 101–25. Berlin: Springer. https://doi.org/10.1007/978-3-319-00000-0_5.',
      html: 'Brown, Alice. 2018. “Neural networks in practice.” In <i>Handbook of artificial intelligence</i>, edited by Peter Green and Sarah White, 101–25. Berlin: Springer. https://doi.org/10.1007/978-3-319-00000-0_5.',
    })
  })

  test('report', () => {
    expect(entryFor('chicago', report).text).toBe(
      'World Health Organization. 2021. Global report on infection prevention and control. Report no. 12. Geneva: World Health Organization. https://www.who.int/publications/i/item/9789240051164.'
    )
  })

  test('dissertation', () => {
    expect(entryFor('chicago', thesis).text).toBe(
      'Garcia, Maria. 2019. “Learning to see in the dark.” PhD diss., Stanford University. https://purl.stanford.edu/abc123.'
    )
  })

  test('webpage with a full date', () => {
    expect(entryFor('chicago', webpage).text).toBe(
      'Doe, Jane. 2023. “How transformers work.” The Gradient. May 14, 2023. https://thegradient.pub/transformers.'
    )
  })

  test('undated webpage: n.d. and an access date', () => {
    const page: CslItem = {
      id: 'page',
      type: 'webpage',
      title: 'Privacy policy',
      author: [{ literal: 'Google' }],
      'container-title': 'Privacy & Terms',
      URL: 'https://policies.google.com/privacy',
      accessed: { 'date-parts': [[2024, 5, 1]] },
    }
    expect(entryFor('chicago', page)).toEqual({
      text: 'Google. n.d. “Privacy policy.” Privacy & Terms. Accessed May 1, 2024. https://policies.google.com/privacy.',
      html: 'Google. n.d. “Privacy policy.” Privacy &amp; Terms. Accessed May 1, 2024. https://policies.google.com/privacy.',
    })
  })

  test('preprint', () => {
    expect(entryFor('chicago', preprint).text).toBe(
      'Vaswani, Ashish, and Noam Shazeer. 2017. “Attention is all you need.” Preprint, arXiv. https://doi.org/10.48550/arXiv.1706.03762.'
    )
  })

  test('more than ten authors: the first seven and et al.', () => {
    const big: CslItem = {
      ...article,
      author: Array.from({ length: 11 }, (_, i) => ({ family: `Author${i + 1}`, given: 'Alex' })),
    }
    expect(entryFor('chicago', big).text).toStartWith(
      'Author1, Alex, Alex Author2, Alex Author3, Alex Author4, Alex Author5, Alex Author6, Alex Author7, et al. 2020.'
    )
  })

  test('question-mark titles keep their own punctuation inside the quotes', () => {
    expect(entryFor('chicago', { ...article, title: 'Why now?' }).text).toContain(
      '2020. “Why now?” Journal'
    )
  })

  test('page ranges follow CMOS 9.61', () => {
    const pages = (page: string) =>
      entryFor('chicago', { ...article, page }).text.match(/: ([^.]+)\. https/)![1]
    expect(pages('3-10')).toBe('3–10')
    expect(pages('71-72')).toBe('71–72')
    expect(pages('100-104')).toBe('100–104')
    expect(pages('107-108')).toBe('107–8')
    expect(pages('1002-1006')).toBe('1002–6')
    expect(pages('321-328')).toBe('321–28')
    expect(pages('498-532')).toBe('498–532')
    expect(pages('1087-1089')).toBe('1087–89')
    expect(pages('1496-1500')).toBe('1496–500')
    expect(pages('11564-11615')).toBe('11564–615')
  })
})

describe('Chicago author-date in-text citations', () => {
  test('author year, locator without "p."', () => {
    const single = { ...article, author: article.author!.slice(0, 1) }
    expect(
      citeText(
        'chicago',
        [single],
        [one(single.id, { locator: '4' }), one(single.id, { locator: '321-28' })]
      )
    ).toEqual(['(Smith 2020, 4)', '(Smith 2020, 321–28)'])
  })

  test('two and three authors are named; four or more use et al.', () => {
    const four = {
      ...article,
      id: 'four',
      author: [...article.author!, { family: 'Kim', given: 'Ann' }],
    }
    expect(
      citeText(
        'chicago',
        [...LIBRARY, four],
        [one('vaswani2017attention'), one('smith2020deep'), one('four')]
      )
    ).toEqual(['(Vaswani and Shazeer 2017)', '(Smith, Jones, and Lee 2020)', '(Smith et al. 2020)'])
  })

  test('other locator labels', () => {
    expect(
      citeText('chicago', LIBRARY, [
        one('knuth1997art', { locator: '3', label: 'chapter' }),
        one('knuth1997art', { locator: '2', label: 'figure' }),
        one('knuth1997art', { locator: '4', label: 'section' }),
      ])
    ).toEqual(['(Knuth 1997, chap. 3)', '(Knuth 1997, fig. 2)', '(Knuth 1997, sec. 4)'])
  })

  test('multiple works keep the author’s order', () => {
    expect(
      citeText('chicago', LIBRARY, [
        { items: [{ id: 'knuth1997art' }, { id: 'brown2018neural', locator: '5' }] },
      ])
    ).toEqual(['(Knuth 1997; Brown 2018, 5)'])
  })

  test('author-in-text and same-year disambiguation', () => {
    const a = { ...book, id: 'k1', title: 'Volume one' }
    const b = { ...book, id: 'k2', title: 'Volume two' }
    const result = createCitationProcessor('chicago', [a, b]).process([
      { items: [{ id: 'k2' }], mode: 'author-in-text' },
      { items: [{ id: 'k1' }, { id: 'k2' }] },
    ])
    expect(result.clusters.map((c) => c.text)).toEqual(['Knuth (1997b)', '(Knuth 1997a, 1997b)'])
    expect(result.bibliography.map((e) => e.text.slice(0, 24))).toEqual([
      'Knuth, Donald E. 1997a. ',
      'Knuth, Donald E. 1997b. ',
    ])
  })
})
