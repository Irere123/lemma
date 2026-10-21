import { describe, expect, test } from 'bun:test'

import { type CslItem, createCitationProcessor, STYLES, type StyleId } from '../../src/citations'
import { article, book, LIBRARY, one } from './fixtures'

const STYLE_IDS: StyleId[] = ['apa', 'chicago', 'ieee', 'nature']

describe('citation processor', () => {
  test('STYLES lists every style with its kind', () => {
    expect(STYLES.map((s) => [s.id, s.kind])).toEqual([
      ['apa', 'author-date'],
      ['chicago', 'author-date'],
      ['ieee', 'numeric'],
      ['nature', 'numeric'],
    ])
    for (const style of STYLES) expect(style.label.length).toBeGreaterThan(0)
  })

  test.each(
    STYLE_IDS
  )('%s: one output per cluster; only cited items in the bibliography', (style) => {
    const result = createCitationProcessor(style, LIBRARY).process([
      one('knuth1997art'),
      { items: [] },
      one('smith2020deep'),
    ])
    expect(result.clusters).toHaveLength(3)
    expect(result.clusters[1]).toEqual({ text: '', html: '' })
    expect(result.bibliography.map((e) => e.id).sort()).toEqual(['knuth1997art', 'smith2020deep'])
    expect(result.missing).toEqual([])
  })

  test('unknown ids are reported and rendered as placeholders', () => {
    const clusters = [
      { items: [{ id: 'knuth1997art' }, { id: 'ghost' }] },
      one('ghost'),
      one('other'),
    ]
    const render = (style: StyleId) => createCitationProcessor(style, LIBRARY).process(clusters)
    expect(render('apa').missing).toEqual(['ghost', 'other'])
    expect(render('apa').clusters.map((c) => c.text)).toEqual([
      '(Knuth, 1997; missing: ghost)',
      '(missing: ghost)',
      '(missing: other)',
    ])
    expect(render('chicago').clusters[1]!.text).toBe('(missing: ghost)')
    expect(render('ieee').clusters.map((c) => c.text)).toEqual(['[1], [?]', '[?]', '[?]'])
    expect(render('nature').clusters[0]!.html).toBe('<sup>1,[?]</sup>')
    expect(render('ieee').bibliography).toHaveLength(1)
  })

  test.each(STYLE_IDS)('%s: every field is HTML-escaped and only <i>/<sup> appear', (style) => {
    const hostile: CslItem = {
      id: 'x',
      type: 'article-journal',
      title: '<script>alert("x")</script> & friends',
      'container-title': 'Journal <b>of</b> "Tests"',
      author: [{ family: 'O’Brien <img src=x onerror=alert(1)>', given: 'Al' }],
      issued: { 'date-parts': [[2020]] },
      volume: '1<2',
      page: '1-2',
      URL: 'https://example.org/?a=1&b=<2>',
    }
    const result = createCitationProcessor(style, [hostile]).process([
      one('x', { prefix: '<em>see</em>', suffix: '& more' }),
      { items: [{ id: 'x' }], mode: 'author-in-text' },
    ])
    const html = [...result.clusters.map((c) => c.html), result.bibliography[0]!.html].join('\n')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<b>')
    expect(html).not.toContain('<em>')
    for (const tag of html.match(/<[^>]*>/g) ?? []) expect(tag).toMatch(/^<\/?(i|sup)>$/)
    expect(html).toContain('&lt;script&gt;')
    expect(result.bibliography[0]!.text).toContain('<script>alert("x")</script> & friends')
  })

  test('accepts a Map as the library and is pure across calls', () => {
    const library = new Map<string, CslItem>([
      ['k', { ...book, id: 'k' }],
      ['s', { ...article, id: 's' }],
    ])
    const processor = createCitationProcessor('ieee', library)
    const first = processor.process([one('s'), one('k')])
    const second = processor.process([one('k'), one('s')])
    expect(first.bibliography.map((e) => e.id)).toEqual(['s', 'k'])
    expect(second.bibliography.map((e) => e.id)).toEqual(['k', 's'])
    expect(processor.process([one('s'), one('k')])).toEqual(first)
  })

  test('rejects an unknown style', () => {
    expect(() => createCitationProcessor('mla' as StyleId, [])).toThrow('Unknown citation style')
  })
})
