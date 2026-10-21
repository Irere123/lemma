/**
 * Property-based round trips over random valid documents (test/arbitraries.ts):
 *
 *   generator  every generated doc is already what validateContent returns,
 *              and the generator covers every node, mark and attribute
 *   HTML       parse(renderToHTML(doc)) is doc (with and without KaTeX)
 *   email      renderToEmail never throws and keeps every text and equation
 *   Yjs        readFields(createYDoc(fields)) is fields
 *   Markdown   markdownToContent(renderToMarkdown(doc)) is doc minus exactly
 *              what markdownLoss(doc) reports (model: test/markdown-model.ts)
 *
 * Block ids are compared stripped (identity, deliberately not in HTML or
 * Markdown); Markdown also renumbers footnote ids (it writes [^1], [^2]…).
 *
 * Known limitations, each a CONSTRAINT in arbitraries.ts rather than a weaker
 * assertion: HTML import collapses whitespace and reads a missing alt as "";
 * y-prosemirror drops marks on non-text inline nodes; Tiptap's `fromString`
 * turns number-like link/image titles into numbers; marked can't skip a code
 * span holding a backtick inside link text; Bun's regex engine mis-reads
 * U+F800–U+FBFF before U+FC00–U+FFFF.
 *
 * The regression cases at the end are shrunk counterexamples these properties
 * found, kept so each fix stays covered whatever seed a run uses.
 */
import { describe, expect, test } from 'bun:test'
import type { JSONContent } from '@tiptap/core'
import { DOMParser as PMDOMParser } from '@tiptap/pm/model'
import fc from 'fast-check'
import katex from 'katex'

import { escapeHtml, markdownLoss, renderToEmail, renderToHTML, renderToMarkdown } from '../src'
import { markdownToContent } from '../src/markdown-parse'
import { getContentSchema, toPlainJSON, validateContent } from '../src/schema'
import { createYDoc, readFields } from '../src/yjs'
import { docArb, fieldsArb } from './arbitraries'
import { renumberFootnotes, withoutMarkdownLoss } from './markdown-model'

const schema = getContentSchema()

// Tuned so the whole file runs well under 20 s. fast-check prints the seed and
// the shrunk counterexample on failure; replay with { seed, path }.
const RUNS = Number(process.env.PROPERTY_RUNS ?? 150)
const params = (numRuns = RUNS): fc.Parameters<unknown> => ({ numRuns, includeErrorInReport: true })
// Generous per-test ceiling; the runs above keep each property to a few seconds.
const TIMEOUT = Math.max(30_000, RUNS * 200)

/**
 * Block ids (Tiptap UniqueID) are identity, not content, and are intentionally
 * not carried through HTML import. Footnote ids are content: they link a
 * reference to its note, so they stay.
 */
function stripBlockIds(node: JSONContent): JSONContent {
  const { attrs, content, ...out } = node as JSONContent & { attrs?: Record<string, unknown> }
  const keep = node.type === 'footnote' || node.type === 'footnoteReference'
  if (attrs) {
    const { id: _id, ...rest } = attrs
    const kept = keep ? attrs : rest
    if (Object.keys(kept).length > 0) out.attrs = kept
  }
  if (content) out.content = content.map(stripBlockIds)
  return out
}

function parseHTML(html: string): JSONContent {
  const container = document.createElement('div')
  container.innerHTML = html
  const doc = PMDOMParser.fromSchema(schema).parse(container)
  doc.check()
  return toPlainJSON(doc)
}

// What the API passes in production (apps/api/src/lib/documents/render.ts).
const katexHtml = (latex: string, displayMode: boolean) =>
  katex.renderToString(latex, { displayMode, throwOnError: false, output: 'htmlAndMathml' })
const katexMathml = (latex: string, displayMode: boolean) =>
  katex
    .renderToString(latex, { displayMode, throwOnError: false, output: 'mathml' })
    .replace(/<annotation encoding="application\/x-tex">[\s\S]*?<\/annotation>/g, '')

function walk(node: JSONContent, visit: (node: JSONContent) => void): void {
  visit(node)
  for (const child of node.content ?? []) walk(child, visit)
}

function checkHtml(doc: JSONContent, withKatex: boolean): void {
  const html = renderToHTML(doc, {
    ...(withKatex ? { renderMath: katexHtml } : {}),
    // Resolved links are <a data-document-link>; unresolved ones are text by design.
    documentLink: ({ documentId, title }) => ({ href: `/d/${documentId}`, title }),
  })
  expect(stripBlockIds(parseHTML(html))).toEqual(stripBlockIds(doc))
}

const canonicalMarkdownDoc = (json: JSONContent) =>
  renumberFootnotes(stripBlockIds(validateContent(json, { strict: true })))

function checkMarkdown(doc: JSONContent): void {
  const markdown = renderToMarkdown(doc)
  const expected = withoutMarkdownLoss(doc)
  const reported = markdownLoss(doc).map(({ feature, count }) => ({ feature, count }))
  expect(reported).toEqual(expected.losses)
  expect(canonicalMarkdownDoc(markdownToContent(markdown))).toEqual(
    canonicalMarkdownDoc(expected.doc)
  )
}

describe('generator', () => {
  test(
    'every generated document is already valid and canonical',
    () => {
      fc.assert(
        fc.property(docArb(), (doc) => {
          expect(validateContent(doc, { strict: true })).toEqual(doc)
        }),
        params(300)
      )
    },
    TIMEOUT
  )

  test(
    'covers every node, mark and attribute in the schema',
    () => {
      const nodes = new Set<string>()
      const marks = new Set<string>()
      const varied = new Set<string>()
      const note = (kind: string, type: string, attrs: Record<string, unknown> | undefined) => {
        const spec =
          kind === 'node' ? schema.nodes[type]?.spec.attrs : schema.marks[type]?.spec.attrs
        for (const [key, value] of Object.entries(attrs ?? {})) {
          if (JSON.stringify(value) !== JSON.stringify(spec?.[key]?.default ?? null))
            varied.add(`${type}.${key}`)
        }
      }
      for (const doc of fc.sample(docArb(), { numRuns: 400, seed: 1 })) {
        walk(doc, (node) => {
          nodes.add(node.type ?? '')
          note('node', node.type ?? '', node.attrs)
          for (const mark of node.marks ?? []) {
            marks.add(mark.type)
            note('mark', mark.type, mark.attrs)
          }
        })
      }
      expect(Object.keys(schema.nodes).filter((name) => !nodes.has(name))).toEqual([])
      expect(Object.keys(schema.marks).filter((name) => !marks.has(name))).toEqual([])

      // Attributes pinned to their default on purpose (see arbitraries.ts).
      const pinned = new Set(['link.target', 'link.rel', 'link.class'])
      const attrs = [
        ...Object.entries(schema.nodes).flatMap(([name, type]) =>
          Object.keys(type.spec.attrs ?? {}).map((key) => `${name}.${key}`)
        ),
        ...Object.entries(schema.marks).flatMap(([name, type]) =>
          Object.keys(type.spec.attrs ?? {}).map((key) => `${name}.${key}`)
        ),
      ]
      expect(attrs.filter((attr) => !pinned.has(attr) && !varied.has(attr))).toEqual([])
    },
    TIMEOUT
  )
})

describe('published HTML', () => {
  // Known HTML-import limitations, constrained in the generator (see report).
  const HTML_SAFE = { collapsibleWhitespace: false }

  test(
    'parse(renderToHTML(doc)) is the same document',
    () => {
      fc.assert(fc.property(docArb(HTML_SAFE), fc.boolean(), checkHtml), params())
    },
    TIMEOUT
  )
})

describe('email HTML', () => {
  test(
    'never throws and keeps every text and equation',
    () => {
      fc.assert(
        fc.property(docArb(), fc.boolean(), (doc, withMathml) => {
          const renderMath = withMathml ? katexMathml : undefined
          const html = renderToEmail(doc, { renderMath })
          walk(doc, (node) => {
            if (node.type === 'text') expect(html).toContain(escapeHtml(node.text ?? ''))
            if (node.type === 'inlineMath' || node.type === 'blockMath') {
              const latex = String(node.attrs?.latex ?? '')
              const display = node.type === 'blockMath'
              expect(html).toContain(renderMath ? renderMath(latex, display) : escapeHtml(latex))
            }
          })
        }),
        params()
      )
    },
    TIMEOUT
  )
})

describe('Yjs', () => {
  test(
    'readFields(createYDoc(fields)) returns the same fields',
    () => {
      fc.assert(
        // y-prosemirror keeps marks on text only (see report): no marks on atoms.
        fc.property(docArb({ atomMarks: false }), fieldsArb, (doc, { title, subtitle }) => {
          const back = readFields(createYDoc({ title, subtitle, content: doc }))
          expect(back.title).toBe(title)
          expect(back.subtitle).toBe(subtitle)
          expect(stripBlockIds(back.content)).toEqual(stripBlockIds(doc))
        }),
        params()
      )
    },
    TIMEOUT
  )
})

describe('Markdown', () => {
  test(
    'markdownToContent(renderToMarkdown(doc)) loses exactly what markdownLoss reports',
    () => {
      fc.assert(fc.property(docArb(), checkMarkdown), params())
    },
    TIMEOUT
  )

  test(
    'renderToMarkdown reports the same losses through onLoss',
    () => {
      fc.assert(
        fc.property(docArb(), (doc) => {
          let seen: unknown
          renderToMarkdown(doc, { onLoss: (losses) => (seen = losses) })
          expect(seen).toEqual(markdownLoss(doc))
        }),
        params(50)
      )
    },
    TIMEOUT
  )
})

// ---------------------------------------------------------------------------
// Regressions: shrunk counterexamples from the properties above
// ---------------------------------------------------------------------------

type Marks = NonNullable<JSONContent['marks']>
const text = (value: string, marks?: Marks): JSONContent =>
  marks ? { type: 'text', text: value, marks } : { type: 'text', text: value }
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
const br = (marks?: Marks): JSONContent =>
  marks ? { type: 'hardBreak', marks } : { type: 'hardBreak' }
const math = (latex: string, marks?: Marks): JSONContent => ({
  type: 'inlineMath',
  attrs: { latex },
  ...(marks ? { marks } : {}),
})
const ref = (id: string, marks?: Marks): JSONContent => ({
  type: 'footnoteReference',
  attrs: { id },
  ...(marks ? { marks } : {}),
})
const notes = (...bodies: [string, JSONContent][]): JSONContent => ({
  type: 'footnotes',
  content: bodies.map(([id, body]) => ({ type: 'footnote', attrs: { id }, content: [body] })),
})
const list = (type: string, attrs: Record<string, unknown>, ...items: JSONContent[]) => ({
  type,
  attrs,
  content: items,
})
const item = (...content: JSONContent[]): JSONContent => ({ type: 'listItem', content })
const task = (...content: JSONContent[]): JSONContent => ({
  type: 'taskItem',
  attrs: { checked: false },
  content,
})
const cell = (type: string, ...content: JSONContent[]): JSONContent => ({ type, content })
const table = (...rows: JSONContent[][]): JSONContent => ({
  type: 'table',
  content: rows.map((cells) => ({ type: 'tableRow', content: cells })),
})
const codeBlock = (code: string): JSONContent => ({ type: 'codeBlock', content: [text(code)] })
const doc = (...content: JSONContent[]): JSONContent =>
  validateContent({ type: 'doc', content }, { strict: true })

const bold = { type: 'bold' }
const italic = { type: 'italic' }
const strike = { type: 'strike' }
const code = { type: 'code' }
const sub = { type: 'subscript' }
const link = (href = 'https://example.com/') => ({ type: 'link', attrs: { href } })
const color = (value: string) => ({ type: 'textStyle', attrs: { color: value } })
const note = (body = 'note') => p(text(body))

describe('HTML regressions', () => {
  const cases: [string, JSONContent][] = [
    [
      'marks on math, breaks and footnote references',
      doc(
        p(math('x', [color('black'), bold]), br([italic]), text('a'), ref('fn-1', [link()])),
        notes(['fn-1', note()])
      ),
    ],
    ['ordered-list numbering style', doc(list('orderedList', { start: 3, type: 'a' }, item(p())))],
    [
      'unset column widths in a merged cell',
      doc(
        table(
          [{ type: 'tableHeader', attrs: { colspan: 2, colwidth: [0, 150] }, content: [p()] }],
          [cell('tableCell', p()), cell('tableCell', p())]
        )
      ),
    ],
    [
      'colours read back exactly',
      doc(
        p(
          text('a', [color('#B91C1C')]),
          math('x', [color('oklch(70% 0.1 200)')]),
          text('b', [{ type: 'highlight', attrs: { color: null } }])
        )
      ),
    ],
    [
      'YouTube /live/ URLs',
      doc({ type: 'youtube', attrs: { src: 'https://www.youtube.com/live/dQw4w9WgXcQ' } }),
    ],
  ]
  for (const [name, input] of cases) {
    test(name, () => {
      checkHtml(input, false)
      checkHtml(input, true)
    })
  }
})

describe('Markdown regressions', () => {
  const cases: [string, JSONContent][] = [
    [
      'empty list items and task boxes',
      doc(
        list(
          'taskList',
          {},
          task(p()),
          task(p(), list('bulletList', {}, item(p()))),
          task(p(), p())
        ),
        list(
          'orderedList',
          { start: 0 },
          item(p(), p(text('x'))),
          item(p(br()), list('bulletList', {}, item(p())))
        )
      ),
    ],
    [
      'TeX that collides with Markdown',
      doc(
        p(math('\\\\'), math('x')),
        p(math('x*', [bold]), text(' '), math('x`', [italic, strike])),
        p(math('`*', [bold]), text('5'), math(' padded '), math('x\\'))
      ),
    ],
    [
      'characters marked mangles',
      doc(
        list('bulletList', {}, item(p(text('a\tb'), text('c\td', [code])), codeBlock('\tx'))),
        table([cell('tableHeader', p(math('x'), text(' <')))]),
        { type: 'callout', attrs: { emoji: '💡' }, content: [codeBlock(' > ')] }
      ),
    ],
    [
      'escapes marked undoes inside links and images',
      doc(
        p(text('![a](b)', [link(), bold])),
        { type: 'image', attrs: { src: 'https://a.example/c.png', alt: '[a](b)' } },
        p(text('\\', [link()]), ref('fn-1', [link()])),
        p(text('^', [link()]), ref('fn-1', [link()])),
        // An unbalanced "(" in a title stopped marked skipping the link.
        p(
          text('x', [{ type: 'link', attrs: { href: 'https://e.x/', title: '(**<' } }, bold]),
          text('y', [bold])
        ),
        notes(['fn-1', note()])
      ),
    ],
    [
      'autolinks and images by accident',
      doc(p(text('alphawww.example.com xhttps://x.y a@b.co wow!'), text('link', [link()]))),
    ],
    [
      'footnote syntax in text and code',
      doc(
        p(text('[^1]', [code]), ref('fn-a'), text('(x)')),
        p(ref('fn-b'), text(': y')),
        notes(['fn-a', note('[^fn-1]:  ')], ['fn-b', p(br(), text(':---:'))])
      ),
    ],
    [
      'block syntax at line starts',
      doc(p(text('- a'), br(), text('1. b'), br(), text('# c')), {
        type: 'heading',
        attrs: { level: 2 },
        content: [text('a #')],
      }),
    ],
    [
      'emphasis where marked and CommonMark disagree',
      doc(
        p(text('alpha', [bold, italic]), text('<', [bold]), text('x ', [bold, italic])),
        p(text('alpha', [italic]), text('alpha💡', [bold, italic])),
        p(text('alpha', [italic, sub]), text('alpha~~', [bold, italic]), br([italic, sub])),
        p(text('\\', [code]), text('alpha', [bold, italic, strike]), text('alpha', [code]))
      ),
    ],
    [
      'adjacent lists, quotes and callouts',
      doc(
        list('bulletList', {}, item(p(text('a')))),
        list('taskList', {}, task(p(text('b')))),
        { type: 'blockquote', content: [p(text('🎉 party'))] },
        { type: 'callout', attrs: { emoji: '🇷🇼' }, content: [{ type: 'heading', content: [] }] }
      ),
    ],
    [
      'YouTube embed versus a link to YouTube',
      doc(p(text('Video', [link('https://youtu.be/dQw4w9WgXcQ')])), {
        type: 'youtube',
        attrs: { src: 'https://youtu.be/dQw4w9WgXcQ', start: 42 },
      }),
    ],
    [
      'pipes in table cells',
      doc(
        table(
          [
            cell('tableHeader', p(text('|alpha', [strike]))),
            cell('tableHeader', p(text('a|b', [code]))),
          ],
          [cell('tableCell', p(math('a\\|b'))), cell('tableCell', p(), p())]
        )
      ),
    ],
  ]
  for (const [name, input] of cases) test(name, () => checkMarkdown(input))

  test('reports what it drops', () => {
    const losses = markdownLoss(
      doc(
        p(text('red', [color('#b91c1c')]), text(' and plain')),
        { type: 'youtube', attrs: { src: 'https://youtu.be/dQw4w9WgXcQ', start: 42 } },
        list('orderedList', { type: 'i' }, item(p(text('x'))))
      )
    )
    expect(losses.map(({ feature, count }) => [feature, count])).toEqual([
      ['textColor', 1],
      ['orderedListType', 1],
      ['videoStartTime', 1],
    ])
    expect(markdownLoss(doc(p(text('plain'))))).toEqual([])
  })
})
