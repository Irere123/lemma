import { describe, expect, test } from 'bun:test'

import { type CslItem, createCitationProcessor } from '../../src/citations'
import {
  article,
  book,
  chapter,
  entryFor,
  LIBRARY,
  one,
  preprint,
  report,
  thesis,
  webpage,
} from './fixtures'

describe('Nature reference list', () => {
  test('journal article', () => {
    expect(entryFor('nature', article)).toEqual({
      text: '1. Smith, J., Jones, J. & Lee, K. The deep learning revolution. Journal of Machine Learning Research 12, 45–67 (2020).',
      html: '1. Smith, J., Jones, J. &amp; Lee, K. The deep learning revolution. <i>Journal of Machine Learning Research</i> 12, 45–67 (2020).',
    })
  })

  test('book', () => {
    expect(entryFor('nature', book)).toEqual({
      text: '1. Knuth, D. E. The art of computer programming 3rd edn (Addison-Wesley, 1997).',
      html: '1. Knuth, D. E. <i>The art of computer programming</i> 3rd edn (Addison-Wesley, 1997).',
    })
  })

  test('chapter', () => {
    expect(entryFor('nature', chapter).text).toBe(
      '1. Brown, A. Neural networks in practice. in Handbook of artificial intelligence (eds Green, P. & White, S.) 101–125 (Springer, 2018).'
    )
  })

  test('report', () => {
    expect(entryFor('nature', report).text).toBe(
      '1. World Health Organization. Global report on infection prevention and control. Report No. 12 (World Health Organization, 2021).'
    )
  })

  test('thesis', () => {
    expect(entryFor('nature', thesis)).toEqual({
      text: '1. Garcia, M. Learning to see in the dark. PhD thesis, Stanford University (2019).',
      html: '1. Garcia, M. <i>Learning to see in the dark</i>. PhD thesis, Stanford University (2019).',
    })
  })

  test('webpage', () => {
    expect(entryFor('nature', webpage).text).toBe(
      '1. Doe, J. How transformers work. The Gradient https://thegradient.pub/transformers (2023).'
    )
  })

  test('preprint', () => {
    expect(entryFor('nature', preprint).text).toBe(
      '1. Vaswani, A. & Shazeer, N. Attention is all you need. Preprint at https://arxiv.org/abs/1706.03762 (2017).'
    )
  })

  test('two authors, more than five authors, and an edited book', () => {
    const two = { ...article, author: article.author!.slice(0, 2) }
    expect(entryFor('nature', two).text).toStartWith('1. Smith, J. & Jones, J. The deep')
    const six: CslItem = {
      ...article,
      author: Array.from({ length: 6 }, (_, i) => ({ family: `Author${i + 1}`, given: 'Alex' })),
    }
    expect(entryFor('nature', six).text).toStartWith('1. Author1, A. et al. The deep')
    const edited: CslItem = {
      id: 'ed',
      type: 'book',
      title: 'Edited volume',
      editor: [{ family: 'Editor', given: 'Ed' }],
      issued: { 'date-parts': [[2015]] },
      publisher: 'Pub',
    }
    expect(entryFor('nature', edited).text).toBe('1. Editor, E. (ed.) Edited volume (Pub, 2015).')
  })
})

describe('Nature in-text citations', () => {
  const process = (
    clusters: Parameters<ReturnType<typeof createCitationProcessor>['process']>[0]
  ) => createCitationProcessor('nature', LIBRARY).process(clusters).clusters

  test('superscript numbers, comma-separated, ranges compressed', () => {
    expect(
      process([
        { items: [{ id: 'smith2020deep' }, { id: 'knuth1997art' }] },
        { items: [{ id: 'brown2018neural' }, { id: 'knuth1997art' }, { id: 'smith2020deep' }] },
        one('smith2020deep'),
        { items: [{ id: 'who2021global' }, { id: 'smith2020deep' }] },
      ])
    ).toEqual([
      { text: '1,2', html: '<sup>1,2</sup>' },
      { text: '1–3', html: '<sup>1–3</sup>' },
      { text: '1', html: '<sup>1</sup>' },
      { text: '1,4', html: '<sup>1,4</sup>' },
    ])
  })

  test('author-in-text and locators', () => {
    expect(
      process([
        { items: [{ id: 'smith2020deep' }], mode: 'author-in-text' },
        one('smith2020deep', { locator: '4' }),
      ])
    ).toEqual([
      { text: 'Smith et al.1', html: 'Smith et al.<sup>1</sup>' },
      { text: '1 (p. 4)', html: '<sup>1 (p. 4)</sup>' },
    ])
  })
})
