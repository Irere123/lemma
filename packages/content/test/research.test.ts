import { describe, expect, test } from 'bun:test'
import type { JSONContent } from '@tiptap/core'
import { DOMParser as PMDOMParser } from '@tiptap/pm/model'

import {
  citationClusters,
  citedReferenceIds,
  documentLinks,
  lowerDocument,
  markdownLoss,
  numberDocument,
  numberingOf,
  type RenderedCitations,
  renderToEmail,
  renderToHTML,
  renderToMarkdown,
} from '../src'
import { getContentSchema, validateContent } from '../src/schema'

const text = (value: string, marks?: JSONContent['marks']): JSONContent =>
  marks ? { type: 'text', text: value, marks } : { type: 'text', text: value }
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })

const imageFigure = (id: string | null, caption: string): JSONContent => ({
  type: 'figure',
  attrs: { id },
  content: [
    { type: 'image', attrs: { src: 'https://example.com/a.png', alt: 'Alt text' } },
    { type: 'figcaption', content: caption ? [text(caption)] : [] },
  ],
})
const tableFigure = (id: string, caption: string): JSONContent => ({
  type: 'figure',
  attrs: { id },
  content: [
    {
      type: 'table',
      content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [p(text('H'))] }] }],
    },
    { type: 'figcaption', content: [text(caption)] },
  ],
})
const equation = (id: string | null, latex: string, tag: string | null = null): JSONContent => ({
  type: 'blockMath',
  attrs: { id, latex, numbered: true, tag },
})
const ref = (target: string): JSONContent => ({ type: 'crossReference', attrs: { target } })
const cite = (
  items: { id: string; locator?: string; label?: string; prefix?: string; suffix?: string }[],
  mode = 'normal'
): JSONContent => ({ type: 'citation', attrs: { items, mode } })

const sample = doc(
  { type: 'heading', attrs: { id: 'secmethods', level: 2 }, content: [text('Methods')] },
  imageFigure('figfirst01', 'First'),
  tableFigure('tabfirst01', 'Counts'),
  imageFigure('figsecond1', 'Second'),
  equation('eqone00001', 'a=b'),
  equation('eqtagged01', 'c=d', '3.2'),
  equation('eqtwo00001', 'e=f'),
  p(
    text('See '),
    ref('figsecond1'),
    text(', '),
    ref('tabfirst01'),
    text(', '),
    ref('eqtwo00001'),
    text(', '),
    ref('secmethods'),
    text(' and '),
    ref('nowhere000')
  )
)

describe('numbering', () => {
  test('figures and tables count separately, in reading order', () => {
    const targets = numberDocument(sample)
    expect(targets.get('figfirst01')?.label).toBe('Figure 1')
    expect(targets.get('figsecond1')?.label).toBe('Figure 2')
    expect(targets.get('tabfirst01')?.label).toBe('Table 1')
    expect(targets.get('figsecond1')?.text).toBe('Second')
  })

  test('a fixed tag keeps its number and uses none up', () => {
    const targets = numberDocument(sample)
    expect(targets.get('eqone00001')?.label).toBe('Eq. (1)')
    expect(targets.get('eqtagged01')?.label).toBe('Eq. (3.2)')
    expect(targets.get('eqtwo00001')?.label).toBe('Eq. (2)')
  })

  test('headings are referenced by their text; footnotes by number', () => {
    const withNote = doc(p(text('x'), { type: 'footnoteReference', attrs: { id: 'fn-q' } }), {
      type: 'heading',
      attrs: { id: 'secother1', level: 2 },
      content: [text('Results')],
    })
    const targets = numberDocument(withNote)
    expect(targets.get('secother1')?.label).toBe('Results')
    expect(targets.get('fn-q')?.label).toBe('note 1')
  })

  test('moving a figure renumbers everything after it', () => {
    const [heading, first, table, second, ...rest] = sample.content ?? []
    const moved = doc(
      heading as JSONContent,
      second as JSONContent,
      first as JSONContent,
      table as JSONContent,
      ...(rest as JSONContent[])
    )
    const targets = numberDocument(moved)
    expect(targets.get('figsecond1')?.label).toBe('Figure 1')
    expect(targets.get('figfirst01')?.label).toBe('Figure 2')
  })

  test('nodes without a block id are still numbered', () => {
    const noIds = doc(imageFigure(null, 'A'), imageFigure('figlater01', 'B'))
    const numbering = numberingOf(noIds)
    const first = noIds.content?.[0] as JSONContent
    expect(numbering.of(first)?.label).toBe('Figure 1')
    expect(numbering.targets.get('figlater01')?.label).toBe('Figure 2')
  })
})

describe('published HTML', () => {
  const html = renderToHTML(sample)

  test('figures carry their label; table captions go above the table', () => {
    expect(html).toMatch(
      /<figure id="figfirst01" data-figure class="figure"><img[^>]*><figcaption><span class="figure-label">Figure 1\.<\/span> <span class="figure-caption">First<\/span><\/figcaption><\/figure>/
    )
    expect(html).toMatch(
      /<figure id="tabfirst01" data-figure class="figure figure-table"><figcaption><span class="figure-label">Table 1\.<\/span> <span class="figure-caption">Counts<\/span><\/figcaption><div class="table-wrap">/
    )
  })

  test('numbered equations show their number', () => {
    expect(html).toContain('<span class="equation-number">(1)</span>')
    expect(html).toContain('data-tag="3.2"')
    expect(html).toContain('<span class="equation-number">(3.2)</span>')
  })

  test('cross-references link to their target and read as its label', () => {
    expect(html).toContain(
      '<a data-cross-ref data-target="figsecond1" href="#figsecond1" class="cross-ref">Figure 2</a>'
    )
    expect(html).toContain('>Table 1</a>')
    expect(html).toContain('>Eq. (2)</a>')
    expect(html).toContain('>Methods</a>')
    expect(html).toContain('class="cross-ref cross-ref-missing">(missing reference)</a>')
  })

  test('re-imported, every node comes back', () => {
    const container = document.createElement('div')
    container.innerHTML = html
    const parsed = PMDOMParser.fromSchema(getContentSchema()).parse(container).toJSON()
    const types = new Set<string>()
    const walk = (node: JSONContent) => {
      if (node.type) types.add(node.type)
      node.content?.forEach(walk)
    }
    walk(parsed)
    for (const type of ['figure', 'figcaption', 'blockMath', 'crossReference', 'table', 'image'])
      expect(types).toContain(type)
    const captions = JSON.stringify(parsed)
    // The generated labels are not caption text.
    expect(captions).not.toContain('Figure 1.')
  })

  const citations: RenderedCitations = {
    clusters: [
      { html: '(Smith, 2020, p. 4)', text: '(Smith, 2020, p. 4)' },
      { html: '<sup>2</sup>', text: '2' },
    ],
    bibliography: [
      { id: 'ref-smith', html: 'Smith, J. (2020). <i>Book</i>.', text: 'Smith, J. (2020). Book.' },
      { id: 'ref-lee', html: 'Lee, K. (2021). Paper.', text: 'Lee, K. (2021). Paper.' },
    ],
  }
  const cited = doc(
    p(
      text('As shown '),
      cite([{ id: 'ref-smith', locator: '4' }]),
      text(' and '),
      cite([{ id: 'ref-lee' }])
    ),
    { type: 'bibliography', attrs: { title: 'References' } }
  )

  test('citations render as formatted and link to their entry', () => {
    const out = renderToHTML(cited, { citations })
    expect(out).toContain('<a href="#ref-ref-smith">(Smith, 2020, p. 4)</a>')
    expect(out).toContain('<a href="#ref-ref-lee"><sup>2</sup></a>')
    expect(out).toContain(
      'data-items="[{&quot;id&quot;:&quot;ref-smith&quot;,&quot;locator&quot;:&quot;4&quot;}]"'
    )
  })

  test('the bibliography lists what the processor returned, numbered for numeric styles', () => {
    expect(renderToHTML(cited, { citations })).toContain(
      '<h2>References</h2><ul class="references"><li id="ref-ref-smith">Smith, J. (2020). <i>Book</i>.</li>'
    )
    expect(renderToHTML(cited, { citations: { ...citations, numeric: true } })).toContain(
      '<ol class="references">'
    )
  })

  test('document links link when resolvable, and never leak a private id', () => {
    const linked = doc(
      p({ type: 'documentLink', attrs: { documentId: 'secretid', blockId: null, title: 'Plans' } })
    )
    expect(renderToHTML(linked)).toBe('<p><span class="document-link">Plans</span></p>')
    expect(renderToHTML(linked)).not.toContain('secretid')
    const resolved = renderToHTML(linked, {
      documentLink: ({ documentId }) => ({ href: `/u/me/${documentId}`, title: 'Plans, renamed' }),
    })
    expect(resolved).toContain('href="/u/me/secretid"')
    expect(resolved).toContain('>Plans, renamed</a>')
  })
})

describe('email', () => {
  test('captions, equation numbers, citations and references read in order', () => {
    const out = renderToEmail(sample)
    expect(out).toContain('<strong>Figure 1.</strong> First')
    expect(out).toContain('(1)')
    expect(out).toContain('Figure 2')
    const cited = renderToEmail(
      doc(p(cite([{ id: 'a' }])), { type: 'bibliography', attrs: { title: 'Sources' } }),
      {
        citations: {
          clusters: [{ html: '[1]', text: '[1]' }],
          bibliography: [{ id: 'a', html: '[1] A. Author, “Title.”', text: '' }],
          numeric: true,
        },
      }
    )
    expect(cited).toContain('[1]')
    expect(cited).toContain('Sources</h2><ol')
  })
})

describe('Markdown', () => {
  test('GFM keeps captions as paragraphs and reports every loss', () => {
    const losses = markdownLoss(
      doc(
        imageFigure('figfirst01', 'Caption'),
        equation('eqone00001', 'x'),
        p(cite([{ id: 'a' }]), text(' '), ref('figfirst01')),
        { type: 'bibliography', attrs: { title: 'References' } }
      )
    ).map((loss) => loss.feature)
    expect(losses).toEqual([
      'figure',
      'equationNumber',
      'citation',
      'bibliography',
      'crossReference',
    ])
    const md = renderToMarkdown(
      doc(imageFigure('figfirst01', 'Caption'), p(text('See '), ref('figfirst01')))
    )
    expect(md).toBe('![Alt text](https://example.com/a.png)\n\nCaption\n\nSee Figure 1\n')
  })

  test('Pandoc flavour writes citations, labels and references', () => {
    const md = renderToMarkdown(
      doc(
        { type: 'heading', attrs: { id: 'secmethods', level: 2 }, content: [text('Methods')] },
        { type: 'heading', attrs: { id: 'secunused1', level: 2 }, content: [text('Other')] },
        imageFigure('figfirst01', 'A chart'),
        tableFigure('tabfirst01', 'Counts'),
        equation('eqone00001', 'a=b'),
        p(
          cite([{ id: 'ref1', locator: '4' }, { id: 'ref2' }]),
          text(' '),
          cite([{ id: 'ref1', locator: '2', label: 'chapter' }], 'author-in-text'),
          text(' '),
          cite([{ id: 'ref2' }], 'suppress-author'),
          text(' '),
          ref('figfirst01'),
          text(' '),
          ref('tabfirst01'),
          text(' '),
          ref('eqone00001'),
          text(' '),
          ref('secmethods')
        ),
        { type: 'bibliography', attrs: { title: 'References' } }
      ),
      { flavor: 'pandoc', citationKey: (id) => `key-${id}` }
    )
    expect(md).toContain('## Methods {#sec-secmethods}')
    expect(md).toContain('## Other\n')
    expect(md).toContain(
      '![A chart](https://example.com/a.png){#fig-figfirst01 fig-alt="Alt text"}'
    )
    expect(md).toContain('| H |\n| --- |\n\n: Counts {#tbl-tabfirst01}')
    expect(md).toContain('$$\na=b\n$$ {#eq-eqone00001}')
    expect(md).toContain('[@key-ref1, p. 4; @key-ref2]')
    expect(md).toContain('@key-ref1 [chapter 2]')
    expect(md).toContain('[-@key-ref2]')
    expect(md).toContain('@fig-figfirst01 @tbl-tabfirst01 @eq-eqone00001 @sec-secmethods')
    expect(md).toContain('::: {#refs}\n:::')
  })
})

describe('lowering for DOCX/EPUB', () => {
  test('labels figures and equations and writes references as text', () => {
    const lowered = lowerDocument(
      doc(
        imageFigure('figfirst01', 'A'),
        equation('eqone00001', 'x'),
        p(text('See '), ref('figfirst01'), text(' '), cite([{ id: 'a' }]), text(' in '), {
          type: 'documentLink',
          attrs: { documentId: 'd', title: 'Notes' },
        }),
        { type: 'bibliography', attrs: { title: 'References' } }
      ),
      {
        citations: {
          clusters: [{ html: 'Smith<sup>1</sup>', text: 'Smith1' }],
          bibliography: [{ id: 'a', html: 'Smith, <i>Book</i> &amp; more', text: '' }],
        },
      }
    )
    const [figure, math, paragraph, heading, entry] = lowered?.content ?? []
    expect(figure?.attrs?.label).toBe('Figure 1')
    expect(math?.attrs?.label).toBe('(1)')
    expect(paragraph?.content).toEqual([
      text('See '),
      text('Figure 1'),
      text(' '),
      text('Smith'),
      text('1', [{ type: 'superscript' }]),
      text(' in '),
      text('Notes'),
    ])
    expect(heading).toEqual({ type: 'heading', attrs: { level: 2 }, content: [text('References')] })
    expect(entry?.content).toEqual([
      text('Smith, '),
      text('Book', [{ type: 'italic' }]),
      text(' & more'),
    ])
  })
})

describe('document walks', () => {
  test('citations in order, cited ids once, links with their sentence', () => {
    const d = doc(
      p(
        cite([{ id: 'a' }, { id: 'b', locator: '3' }]),
        text(' then '),
        cite([{ id: 'a' }], 'author-in-text')
      ),
      p(
        text('Read '),
        { type: 'documentLink', attrs: { documentId: 'note1', blockId: 'blk', title: 'Ideas' } },
        text(' today.')
      )
    )
    expect(citationClusters(d)).toEqual([
      { items: [{ id: 'a' }, { id: 'b', locator: '3' }], mode: 'normal' },
      { items: [{ id: 'a' }], mode: 'author-in-text' },
    ])
    expect(citedReferenceIds(d)).toEqual(['a', 'b'])
    expect(documentLinks(d)).toEqual([
      { documentId: 'note1', blockId: 'blk', context: 'Read Ideas today.' },
    ])
  })
})

describe('validation', () => {
  test('citation items are cleaned, and a citation of nothing is dropped', () => {
    const out = validateContent(
      doc(
        p(
          {
            type: 'citation',
            attrs: { items: [{ id: 'a', locator: '', extra: 1 }, { nope: true }, 'x'] },
          },
          { type: 'citation', attrs: { items: [] } },
          text('end')
        )
      )
    )
    expect(out.content?.[0]?.content).toEqual([
      { type: 'citation', attrs: { items: [{ id: 'a' }], mode: 'normal' } },
      text('end'),
    ])
  })

  test('a document link without a target is dropped', () => {
    const out = validateContent(doc(p(text('a'), { type: 'documentLink', attrs: { title: 'x' } })))
    expect(out.content?.[0]?.content).toEqual([text('a')])
  })
})

describe('paste', () => {
  const pasteDoc = (html: string) => {
    const container = document.createElement('div')
    container.innerHTML = html
    return PMDOMParser.fromSchema(getContentSchema()).parse(container).toJSON() as JSONContent
  }

  test('LaTeXML figures keep their caption without the spelled-out number', () => {
    const out = pasteDoc(
      '<figure class="ltx_figure"><img src="https://example.com/f.png" alt=""><figcaption class="ltx_caption"><span class="ltx_tag ltx_tag_figure">Figure 1: </span>The architecture.</figcaption></figure>'
    )
    expect(out.content?.[0]?.type).toBe('figure')
    expect(out.content?.[0]?.content?.[1]).toEqual({
      type: 'figcaption',
      content: [text('The architecture.')],
    })
  })

  test('a table captioned above becomes a table figure', () => {
    const out = pasteDoc(
      '<figure class="ltx_table"><figcaption>Table 1: Results</figcaption><table><tr><td>1</td></tr></table></figure>'
    )
    const figure = out.content?.[0]
    expect(figure?.type).toBe('figure')
    expect(figure?.content?.map((child) => child.type)).toEqual(['table', 'figcaption'])
  })

  test('a grid of sub-figures, or a figure of text, stays plain blocks', () => {
    const grid = pasteDoc(
      '<figure><figure><img src="https://example.com/a.png"></figure><figure><img src="https://example.com/b.png"></figure><figcaption>Both</figcaption></figure>'
    )
    expect(JSON.stringify(grid)).not.toContain('"figure"')
    expect(JSON.stringify(grid)).not.toContain('figcaption')
    const quote = pasteDoc(
      '<figure><blockquote>Words</blockquote><figcaption>Someone</figcaption></figure>'
    )
    expect(JSON.stringify(quote)).not.toContain('"figure"')
    expect(JSON.stringify(quote)).not.toContain('"src":null')
  })

  test('LaTeXML equation numbers are kept', () => {
    const out = pasteDoc(
      '<table class="ltx_equation"><tr><td><math alttext="E=mc^2"><annotation encoding="application/x-tex">E=mc^2</annotation></math></td><td><span class="ltx_tag ltx_tag_equation">(4)</span></td></tr></table>'
    )
    expect(out.content?.[0]?.attrs).toMatchObject({ latex: 'E=mc^2', numbered: true, tag: '4' })
  })
})
