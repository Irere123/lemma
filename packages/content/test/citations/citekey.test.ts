import { describe, expect, test } from 'bun:test'

import { type CslItem, makeCiteKey } from '../../src/citations'

const item = (fields: Partial<CslItem>): CslItem => ({ id: '', type: 'article-journal', ...fields })

describe('makeCiteKey', () => {
  test('family name + year + first significant title word', () => {
    expect(
      makeCiteKey(
        item({
          author: [{ family: 'Smith', given: 'John' }],
          issued: { 'date-parts': [[2020]] },
          title: 'The Deep Learning Revolution',
        }),
        new Set()
      )
    ).toBe('smith2020deep')
  })

  test('ASCII-folds accents, particles and punctuation', () => {
    const key = (family: string, title: string) =>
      makeCiteKey(
        item({ author: [{ family }], issued: { 'date-parts': [[2019]] }, title }),
        new Set()
      )
    expect(key('Müller', 'Über die Analyse')).toBe('muller2019uber')
    expect(key('Ørsted-Łukasz', 'Ångström')).toBe('orstedlukasz2019angstrom')
    expect(key('O’Brien', 'On the <i>E. coli</i> genome')).toBe('obrien2019coli')
  })

  test('skips stop words, including other languages', () => {
    const title = (t: string) =>
      makeCiteKey(
        item({ author: [{ family: 'Doe' }], issued: { 'date-parts': [[2000]] }, title: t }),
        new Set()
      )
    expect(title('A Study of Things')).toBe('doe2000study')
    expect(title('Les Misérables')).toBe('doe2000miserables')
    expect(title('Über die Natur')).toBe('doe2000uber')
  })

  test('falls back to editors, institutions, then title words', () => {
    expect(
      makeCiteKey(
        item({
          editor: [{ family: 'Green' }],
          issued: { 'date-parts': [[2015]] },
          title: 'Handbook',
        }),
        new Set()
      )
    ).toBe('green2015handbook')
    expect(
      makeCiteKey(
        item({ author: [{ literal: 'The World Bank' }], title: 'Poverty and Prosperity' }),
        new Set()
      )
    ).toBe('worldpoverty')
    expect(
      makeCiteKey(
        item({ title: 'Anonymous Pamphlet on Taxes', issued: { 'date-parts': [[1776]] } }),
        new Set()
      )
    ).toBe('anonymous1776pamphlet')
    expect(makeCiteKey(item({}), new Set())).toBe('ref')
  })

  test('dedupes with a, b, c … and records the key', () => {
    const taken = new Set<string>(['smith2020deep'])
    const smith = item({
      author: [{ family: 'Smith' }],
      issued: { 'date-parts': [[2020]] },
      title: 'Deep',
    })
    expect(makeCiteKey(smith, taken)).toBe('smith2020deepa')
    expect(makeCiteKey(smith, taken)).toBe('smith2020deepb')
    expect(taken.has('smith2020deepb')).toBe(true)
    for (let i = 0; i < 24; i++) makeCiteKey(smith, taken)
    expect(makeCiteKey(smith, taken)).toBe('smith2020deepaa')
  })
})
