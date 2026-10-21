import { describe, expect, test } from 'bun:test'

import { lowerDocument, renderToHTML } from '../../src'
import { htmlToXhtml, renderXhtml } from '../../src/export'
import { kitchenSink } from '../fixtures'
import { all, attr, NS, parseXml, textOf } from './helpers'

const wrap = (body: string) =>
  `<html xmlns="${NS.xhtml}" xmlns:epub="${NS.epub}"><body>${body}</body></html>`

describe('htmlToXhtml', () => {
  test('self-closes void elements and gives every attribute a quoted value', () => {
    const out = htmlToXhtml(
      '<p>a<br>b</p><hr><img src=x.png alt="A &amp; B"><input type="checkbox" disabled checked><col style="width:1px">'
    )
    expect(out).toBe(
      '<p>a<br/>b</p><hr/><img src="x.png" alt="A &amp; B"/><input type="checkbox" disabled="" checked=""/><col style="width:1px"/>'
    )
    expect(() => parseXml(wrap(out))).not.toThrow()
  })

  test('turns named entities into characters and escapes unknown ones', () => {
    const out = htmlToXhtml('<p>&nbsp;&mdash;&hellip;&#39;&#x27;&copy;&bogus; &amp; a &lt; b</p>')
    expect(out).toBe("<p> —…''©&amp;bogus; &amp; a &lt; b</p>")
    expect(textOf(parseXml(wrap(out)).documentElement)).toContain(' —')
  })

  test('repairs stray and missing end tags, drops comments, keeps MathML case and self-closing', () => {
    const out = htmlToXhtml(
      '<div><p>one</span></p><!-- note --><math xmlns="http://www.w3.org/1998/Math/MathML"><mspace width="1em"/><mi>x</mi></math><em>open'
    )
    expect(out).toBe(
      '<div><p>one</p><math xmlns="http://www.w3.org/1998/Math/MathML"><mspace width="1em"/><mi>x</mi></math><em>open</em></div>'
    )
    expect(() => parseXml(wrap(out))).not.toThrow()
  })

  test('removes characters XML forbids, keeping emoji', () => {
    const out = htmlToXhtml('<p>bell\u0007 tab\u000b ok 🌊 lone\ud800</p>')
    expect(out).toBe('<p>bell tab ok 🌊 lone</p>')
  })

  test('drops repeated ids and filtered attributes', () => {
    const ids = new Set<string>(['taken'])
    const out = htmlToXhtml(
      '<p id="taken">a</p><p id="fresh">b</p><p id="fresh" class="x" class="y">c</p>',
      {
        ids,
        attribute: (_element, name, value) => (name === 'class' ? null : value),
      }
    )
    expect(out).toBe('<p>a</p><p id="fresh">b</p><p>c</p>')
  })

  test('turns the published HTML of every node type into well-formed XHTML', () => {
    const out = htmlToXhtml(renderToHTML(kitchenSink))
    const doc = parseXml(wrap(out))
    // The plain image and the figure's.
    expect(all(doc, NS.xhtml, 'img')).toHaveLength(2)
    expect(all(doc, NS.xhtml, 'table')).toHaveLength(1)
  })
})

describe('renderXhtml', () => {
  test('renders every node type as strict XHTML with EPUB footnotes and MathML', () => {
    // Exports lower documents first (citations and the bibliography become text).
    const fragment = renderXhtml(lowerDocument(kitchenSink) ?? kitchenSink, { headingOffset: 1 })
    const doc = parseXml(wrap(fragment.body + fragment.notes))
    expect(fragment.math).toBe(true)
    expect(fragment.remote).toBe(true)

    // Chapter title is the h1, so the document's h1–h5 move down a level.
    expect(all(doc, NS.xhtml, 'h1')).toHaveLength(0)
    expect(all(doc, NS.xhtml, 'h2').map(textOf)).toEqual(['Heading one'])
    expect(all(doc, NS.xhtml, 'h6').map(textOf)).toEqual(['Heading five', 'Heading six'])

    const noteref = all(doc, NS.xhtml, 'a').find((a) => attr(a, NS.epub, 'type') === 'noteref')
    expect(noteref).toBeDefined()
    const target = attr(noteref, null, 'href')?.slice(1)
    const aside = all(doc, NS.xhtml, 'aside').find((el) => el.getAttribute('id') === target)
    expect(attr(aside, NS.epub, 'type')).toBe('footnote')
    expect(textOf(aside)).toContain('The note body.')
    // The note links back to its reference.
    const back = all(aside as never, NS.xhtml, 'a')[0]
    expect(attr(back, null, 'href')).toBe(`#${noteref?.getAttribute('id')}`)

    // Inline, display, and the two numbered equations.
    expect(all(doc, NS.mathml, 'math').length).toBe(4)
    expect(fragment.body).not.toContain('application/x-tex')
    // Editor-only attributes and embeds don't survive.
    expect(fragment.body).not.toMatch(/colwidth|loading=|<iframe|target=/)
    expect(fragment.body).toContain('https://www.youtube.com/watch?v=dQw4w9WgXcQ&amp;t=42s')
    // The bare footnotes list is replaced by the asides.
    expect(fragment.body).not.toContain('data-footnotes')
  })

  test('renders figures with numbered captions and equations with labels', () => {
    const fragment = renderXhtml({
      type: 'doc',
      content: [
        {
          type: 'figure',
          attrs: { id: 'figone', label: 'Figure 3' },
          content: [
            { type: 'image', attrs: { src: 'https://example.com/a.png', alt: 'A chart' } },
            { type: 'figcaption', content: [{ type: 'text', text: 'Rainfall by month' }] },
          ],
        },
        { type: 'blockMath', attrs: { latex: 'a^2 + b^2 = c^2', label: '(4)', id: 'eqpythag' } },
      ],
    })
    const doc = parseXml(wrap(fragment.body))
    const figure = all(doc, NS.xhtml, 'figure')[0]
    expect(figure?.getAttribute('id')).toBe('figone')
    expect(all(figure as never, NS.xhtml, 'img')).toHaveLength(1)
    expect(textOf(all(doc, NS.xhtml, 'figcaption')[0])).toBe('Figure 3. Rainfall by month')
    const equation = all(doc, NS.xhtml, 'div').find(
      (div) => div.getAttribute('class') === 'equation'
    )
    expect(equation?.getAttribute('id')).toBe('eqpythag')
    expect(textOf(equation)).toContain('(4)')
    expect(all(equation as never, NS.mathml, 'math')[0]?.getAttribute('display')).toBe('block')
  })

  test('points images where imageSrc says, or shows alt text', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: 'https://example.com/a.png', alt: 'Kept' } },
        { type: 'image', attrs: { src: '/relative.png', alt: 'Dropped' } },
      ],
    }
    const fragment = renderXhtml(doc, {
      imageSrc: (src) => (src.startsWith('https:') ? 'images/image-1.png' : null),
    })
    expect(fragment.body).toContain('<img src="images/image-1.png" alt="Kept"/>')
    expect(fragment.body).toContain('[Dropped]')
    expect(fragment.remote).toBe(false)
  })

  test('never throws on unknown nodes or odd input', () => {
    const odd = {
      type: 'doc',
      content: [
        {
          type: 'mystery',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'kept' }] }],
        },
        { type: 'citation', attrs: { keys: ['a'] } },
        { type: 'footnoteReference', attrs: { id: 'missing' } },
        { type: 'blockMath', attrs: { latex: '\\frac{' } },
        { type: 'figcaption', content: [{ type: 'text', text: 'loose caption' }] },
      ],
    }
    const fragment = renderXhtml(odd)
    expect(() => parseXml(wrap(fragment.body))).not.toThrow()
    expect(fragment.body).toContain('kept')
    expect(fragment.body).toContain('<code class="math-source">\\frac{</code>')
    expect(renderXhtml(null).body).toBe('')
  })
})
