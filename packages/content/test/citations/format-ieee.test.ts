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

describe('IEEE reference list', () => {
  test('journal article', () => {
    expect(entryFor('ieee', article)).toEqual({
      text: '[1] J. Smith, J. Jones, and K. Lee, “The deep learning revolution,” Journal of Machine Learning Research, vol. 12, no. 3, pp. 45–67, Mar. 2020, doi: 10.1000/jmlr.2020.123.',
      html: '[1] J. Smith, J. Jones, and K. Lee, “The deep learning revolution,” <i>Journal of Machine Learning Research</i>, vol. 12, no. 3, pp. 45–67, Mar. 2020, doi: 10.1000/jmlr.2020.123.',
    })
  })

  test('book', () => {
    expect(entryFor('ieee', book)).toEqual({
      text: '[1] D. E. Knuth, The art of computer programming, 3rd ed. Reading, MA: Addison-Wesley, 1997.',
      html: '[1] D. E. Knuth, <i>The art of computer programming</i>, 3rd ed. Reading, MA: Addison-Wesley, 1997.',
    })
  })

  test('chapter in an edited book', () => {
    expect(entryFor('ieee', chapter).text).toBe(
      '[1] A. Brown, “Neural networks in practice,” in Handbook of artificial intelligence, P. Green and S. White, Eds. Berlin: Springer, 2018, pp. 101–125, doi: 10.1007/978-3-319-00000-0_5.'
    )
  })

  test('conference paper', () => {
    const paper: CslItem = {
      id: 'conf',
      type: 'paper-conference',
      title: 'Fast training of deep nets',
      'container-title': 'Proc. IEEE Conf. Comput. Vis. Pattern Recognit.',
      author: [{ family: 'He', given: 'Kaiming' }],
      'publisher-place': 'Las Vegas, NV, USA',
      issued: { 'date-parts': [[2016, 6]] },
      page: '770-778',
    }
    expect(entryFor('ieee', paper).text).toBe(
      '[1] K. He, “Fast training of deep nets,” in Proc. IEEE Conf. Comput. Vis. Pattern Recognit., Las Vegas, NV, USA, Jun. 2016, pp. 770–778.'
    )
  })

  test('report', () => {
    expect(entryFor('ieee', report).text).toBe(
      '[1] World Health Organization, “Global report on infection prevention and control,” World Health Organization, Geneva, Rep. 12, 2021. [Online]. Available: https://www.who.int/publications/i/item/9789240051164'
    )
    expect(entryFor('ieee', { ...report, genre: 'Technical Report' }).text).toContain(
      ', Tech. Rep. 12, 2021.'
    )
  })

  test('dissertation', () => {
    expect(entryFor('ieee', thesis).text).toBe(
      '[1] M. Garcia, “Learning to see in the dark,” Ph.D. dissertation, Stanford University, 2019. [Online]. Available: https://purl.stanford.edu/abc123'
    )
  })

  test('webpage', () => {
    expect(entryFor('ieee', webpage).text).toBe(
      '[1] J. Doe. “How transformers work.” The Gradient. https://thegradient.pub/transformers (accessed Jan. 10, 2024).'
    )
  })

  test('preprint', () => {
    expect(entryFor('ieee', preprint).text).toBe(
      '[1] A. Vaswani and N. Shazeer, “Attention is all you need,” Jun. 2017, arXiv:1706.03762, doi: 10.48550/arXiv.1706.03762.'
    )
  })

  test('September is "Sept." and more than six authors become et al.', () => {
    const big: CslItem = {
      ...article,
      issued: { 'date-parts': [[2020, 9]] },
      author: Array.from({ length: 7 }, (_, i) => ({ family: `Author${i + 1}`, given: 'Alex' })),
    }
    const text = entryFor('ieee', big).text
    expect(text).toStartWith('[1] A. Author1 et al., “The deep')
    expect(text).toContain(', Sept. 2020,')
  })

  test('bibliography follows citation order', () => {
    const result = createCitationProcessor('ieee', LIBRARY).process([
      one('knuth1997art'),
      one('smith2020deep'),
      one('knuth1997art'),
    ])
    expect(result.bibliography.map((e) => [e.number, e.id])).toEqual([
      [1, 'knuth1997art'],
      [2, 'smith2020deep'],
    ])
  })
})

describe('IEEE in-text citations', () => {
  test('numbers by first citation, reused on repeat', () => {
    expect(
      citeText('ieee', LIBRARY, [
        one('smith2020deep'),
        one('smith2020deep'),
        one('knuth1997art'),
        one('brown2018neural'),
      ])
    ).toEqual(['[1]', '[1]', '[2]', '[3]'])
  })

  test('ranges of three or more are compressed; numbers are sorted', () => {
    const ids = [
      'smith2020deep',
      'knuth1997art',
      'brown2018neural',
      'who2021global',
      'garcia2019learning',
    ]
    expect(
      citeText('ieee', LIBRARY, [
        { items: ids.map((id) => ({ id })) },
        { items: [{ id: 'brown2018neural' }, { id: 'smith2020deep' }, { id: 'knuth1997art' }] },
        { items: [{ id: 'smith2020deep' }, { id: 'brown2018neural' }] },
        { items: [{ id: 'smith2020deep' }, { id: 'knuth1997art' }] },
        {
          items: [
            { id: 'garcia2019learning' },
            { id: 'smith2020deep' },
            { id: 'knuth1997art' },
            { id: 'brown2018neural' },
          ],
        },
      ])
    ).toEqual(['[1]–[5]', '[1]–[3]', '[1], [3]', '[1], [2]', '[1]–[3], [5]'])
  })

  test('locators stay inside the brackets and break ranges', () => {
    expect(
      citeText('ieee', LIBRARY, [
        {
          items: [
            { id: 'smith2020deep' },
            { id: 'knuth1997art', locator: '5' },
            { id: 'brown2018neural' },
          ],
        },
        one('smith2020deep', { locator: '2', label: 'figure' }),
        one('smith2020deep', { locator: '4', label: 'chapter' }),
        one('smith2020deep', { locator: '10-12' }),
      ])
    ).toEqual(['[1], [2, p. 5], [3]', '[1, Fig. 2]', '[1, Ch. 4]', '[1, pp. 10–12]'])
  })

  test('author-in-text names the authors before the number', () => {
    expect(
      citeText('ieee', LIBRARY, [
        { items: [{ id: 'smith2020deep' }], mode: 'author-in-text' },
        { items: [{ id: 'vaswani2017attention' }], mode: 'author-in-text' },
      ])
    ).toEqual(['Smith et al. [1]', 'Vaswani and Shazeer [2]'])
  })
})
