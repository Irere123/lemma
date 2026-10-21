import type { JSONContent } from '@tiptap/core'
import fc from 'fast-check'

import { getContentSchema } from '../src/schema'

/**
 * fast-check arbitraries for random VALID Lemma documents: every node, mark and
 * attribute in getContentSchema(), in the exact canonical JSON ProseMirror's
 * `toJSON()` produces (all attrs present, marks in schema order, adjacent text
 * with equal marks merged, footnotes listed once each in reference order). The
 * property suite asserts `validateContent(doc, { strict: true })` returns every
 * generated doc unchanged, so nothing here can lean on validation to repair it.
 *
 * Deliberate constraints (each one is a known limitation, see the report in
 * roundtrip.property.test.ts) are marked CONSTRAINT.
 */

type Json = JSONContent
type Mark = { type: string; attrs?: Record<string, unknown> }

const schema = getContentSchema()
const markRank = Object.keys(schema.marks)

// ---------------------------------------------------------------------------
// Canonical JSON builders
// ---------------------------------------------------------------------------

function filledAttrs(
  type: string,
  given: Record<string, unknown>,
  specs: Record<string, { default?: unknown }> | undefined
): Record<string, unknown> | undefined {
  if (!specs) throw new Error(`generator: unknown type "${type}"`)
  for (const key of Object.keys(given)) {
    if (!(key in specs)) throw new Error(`generator: "${type}" has no attribute "${key}"`)
  }
  const out: Record<string, unknown> = {}
  for (const [key, spec] of Object.entries(specs)) {
    out[key] = key in given ? given[key] : (spec.default ?? null)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function node(
  type: string,
  attrs: Record<string, unknown> = {},
  content?: Json[],
  marks?: Mark[]
): Json {
  const out: Json = { type }
  const spec = schema.nodes[type]?.spec
  const filled = filledAttrs(type, attrs, spec ? (spec.attrs ?? {}) : undefined)
  if (filled) out.attrs = filled
  if (content && content.length > 0) out.content = content
  if (marks && marks.length > 0) out.marks = marks
  return out
}

function mark(type: string, attrs: Record<string, unknown> = {}): Mark {
  const spec = schema.marks[type]?.spec
  const filled = filledAttrs(type, attrs, spec ? (spec.attrs ?? {}) : undefined)
  return filled ? { type, attrs: filled } : { type }
}

const sortMarks = (marks: Mark[]) =>
  [...marks].sort((a, b) => markRank.indexOf(a.type) - markRank.indexOf(b.type))

const sameMarks = (a: Mark[] = [], b: Mark[] = []) => JSON.stringify(a) === JSON.stringify(b)

/** ProseMirror never stores two adjacent text nodes with the same marks. */
function mergeText(items: Json[]): Json[] {
  const out: Json[] = []
  for (const item of items) {
    const last = out[out.length - 1]
    if (item.type === 'text' && last?.type === 'text' && sameMarks(last.marks, item.marks)) {
      out[out.length - 1] = { ...last, text: `${last.text}${item.text}` }
    } else {
      out.push(item)
    }
  }
  return out
}

// Block ids (UniqueID) on whichever types the schema gives an `id`, in the
// shape validateContent accepts (BLOCK_ID_PATTERN). Footnote ids are content.
const blockId = (type: string) =>
  schema.nodes[type]?.spec.attrs?.id && type !== 'footnote' && type !== 'footnoteReference'
    ? fc.option(
        fc.integer({ min: 0, max: 2 ** 40 }).map((n) => `b${n.toString(36).padStart(6, '0')}`),
        { nil: null, freq: 3 }
      )
    : fc.constant(undefined)

const withId = (attrs: Record<string, unknown>, id: string | null | undefined) =>
  id === undefined ? attrs : { ...attrs, id }

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const WORDS = [
  'alpha',
  'Beta',
  'x',
  '42',
  '3.14',
  'naïve',
  'straße',
  '中文',
  'مرحبا',
  'עברית',
  'e\u0301',
  'Ω',
  'Video',
]

const SPACES = [' ', ' ', ' ', '  ', '\t', '\u00a0', ' \u00a0 ']

// Where renderers break: HTML and Markdown syntax, entities, autolinks, emoji.
const TRICKY = [
  '<',
  '>',
  '&',
  '"',
  "'",
  '&amp;',
  '&lt;b&gt;',
  '&#39;',
  '&nbsp;',
  '&#x1F4A1;',
  '<b>',
  '</p>',
  '<br>',
  '<!--',
  '-->',
  '<sup>',
  '*',
  '**',
  '_',
  '__',
  '#',
  '# ',
  '|',
  '[',
  ']',
  '[x]',
  '[ ] ',
  '$',
  '$x$',
  '$$',
  '$5',
  '`',
  '```',
  '~~~',
  '\\',
  '\\*',
  '~',
  '~~',
  '^',
  '[^1]',
  '[^fn-1]: ',
  '!',
  '![a](b)',
  '[a](b)',
  '[a]: /b',
  '(',
  ')',
  '+',
  '+ ',
  '-',
  '- ',
  '---',
  '***',
  '=',
  '===',
  '1.',
  '1. ',
  '2)',
  '> ',
  ':',
  '{',
  '}',
  '%',
  '@',
  'a@b.co',
  'https://example.com',
  'www.example.com',
  '<https://a.b>',
  ':smile:',
  '\u200b',
  '\u2028',
  '🎉',
  '👍🏽',
  '👨‍👩‍👧',
  '🇷🇼',
  '💡',
  '⚠️',
  'ℹ️',
  '1️⃣',
]

// CONSTRAINT: no C0/C1 control characters except tab. HTML parsing normalises
// CR and NUL, and the editor never stores them.
// CONSTRAINT (test runtime only): no U+F800–U+FBFF. Bun's JavaScriptCore regex
// engine reads one of them followed by U+FC00–U+FFFF as a surrogate pair in
// `u` mode, so `[^\s]` in marked matches both; V8 (Node, Workers) is correct.
// (Hence no `u` flag here: it would hit the same bug.)
const CONTROL = /[\u0000-\u0008\u000a-\u001f\u007f-\u009f\ufeff\uf800-\ufbff]/g

const chunk = fc.oneof(
  { weight: 5, arbitrary: fc.constantFrom(...WORDS) },
  { weight: 3, arbitrary: fc.constantFrom(...SPACES) },
  { weight: 4, arbitrary: fc.constantFrom(...TRICKY) },
  {
    weight: 1,
    arbitrary: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 3 }),
  }
)

/** Non-empty inline text without line breaks (those are hardBreak nodes). */
export const textArb = fc
  .array(chunk, { minLength: 1, maxLength: 5 })
  .map((parts) => parts.join('').replace(CONTROL, ''))
  .filter((text) => text.length > 0)

/** Titles and other plain strings. May be empty. */
export const plainStringArb = fc.oneof(
  fc.constant(''),
  textArb,
  fc.string({ unit: 'grapheme', maxLength: 20 }).map((s) => s.replace(CONTROL, ''))
)

const codeLine = fc
  .array(
    fc.oneof(
      { weight: 4, arbitrary: fc.constantFrom(...WORDS, ...SPACES, ...TRICKY) },
      { weight: 1, arbitrary: fc.constantFrom('    ', '\t\t', '```', '````', '~~~', '[^1]: x') }
    ),
    { maxLength: 4 }
  )
  .map((parts) => parts.join('').replace(CONTROL, ''))

const codeText = fc
  .array(codeLine, { maxLength: 4 })
  .chain((lines) =>
    fc.constantFrom(lines.join('\n'), `${lines.join('\n')}\n`, `\n${lines.join('\n')}`)
  )

// TeX: no unescaped `$` (it ends inline math and is invalid inside it).
const TEX = [
  'x',
  'x^2',
  'E = mc^2',
  '\\frac{a}{b}',
  '\\alpha',
  '\\$',
  '\\{',
  '\\}',
  '<',
  '>',
  '&',
  '"',
  "'",
  ' ',
  '\\\\',
  '_',
  '{',
  '}',
  '|',
  '*',
  '\\text{a b}',
  '\\sum_{i=0}^n i',
  '\\|',
  '\\sqrt[3]{x}',
  '`',
  '2',
  '\\%',
]

const inlineLatex = fc.array(fc.constantFrom(...TEX), { maxLength: 5 }).map((p) => p.join(''))
const blockLatex = fc
  .array(fc.oneof(fc.constantFrom(...TEX), fc.constant('\n')), { maxLength: 8 })
  .map((p) => p.join(''))

// ---------------------------------------------------------------------------
// Attribute values
// ---------------------------------------------------------------------------

// CONSTRAINT: hrefs/srcs are already what sanitizeUrl returns (trimmed, safe
// scheme); validateContent would otherwise rewrite or drop them.
const HREFS = [
  'https://example.com/',
  'https://example.com/a?b=1&c=2#frag',
  'http://example.com/wiki/Foo_(bar)',
  'https://example.com/a b',
  'https://example.com/<x>',
  'https://例え.jp/ü',
  'https://example.com/_under_*star*',
  'mailto:a@b.co',
  'tel:+250788000000',
  '#section-2',
  '/relative/path',
  './here',
  '../up',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
]

// CONSTRAINT (Tiptap core): attributes without their own parseHTML go through
// `fromString`, so "123", "1.5", "true" and "false" come back from HTML as a
// number or boolean. Affects link title and image alt/title.
// Number- and boolean-like text included: text attributes parse as strings.
const attrText = textArb

// Colours exactly as safeCssColor returns them (named colours lower-case).
const COLORS = [
  '#334155',
  '#b91c1c',
  '#B91C1C',
  '#abc',
  '#aabbccdd',
  'red',
  'black',
  'white',
  'rebeccapurple',
  'var(--accent)',
  'rgb(1, 2, 3)',
  'rgba(10, 20, 30, 0.5)',
  'hsl(120deg 50% 50%)',
  'oklch(70% 0.1 200)',
]

const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#BFDBFE', 'yellow', 'transparent', 'var(--mark)']

const IMAGE_SRCS = [
  'https://assets.example.com/a.png',
  'https://assets.example.com/a b (1).png',
  '/uploads/x.webp',
  'data:image/png;base64,iVBORw0KGgo=',
]

// Every URL shape Tiptap's isValidYoutubeUrl accepts that the editor stores.
const YOUTUBE_SRCS = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
  'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1',
  'https://youtu.be/dQw4w9WgXcQ',
  'https://youtu.be/dQw4w9WgXcQ?si=abc',
  'https://www.youtube.com/embed/dQw4w9WgXcQ',
  'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  'https://www.youtube.com/shorts/dQw4w9WgXcQ',
  'https://www.youtube.com/live/dQw4w9WgXcQ',
]

// CONSTRAINT: callout emoji is a single emoji (the editor's picker); markdown
// recognises a callout by its leading emoji.
const EMOJI = ['💡', '⚠️', '📌', '✅', '❗', '🔥', 'ℹ️', '👍🏽', '👨‍👩‍👧', '🇷🇼', '1️⃣', '🏴‍☠️']

// CONSTRAINT: code block language is null or one class-safe token; the HTML
// parser reads it back from `class="language-…"`, so spaces split it and an
// empty string reads back as null.
const LANGUAGES = ['ts', 'js', 'python', 'c++', 'objective-c', 'shell', 'c#', 'x.y']

// newFootnoteId() shape plus ids that pasted or imported content can carry.
export const FOOTNOTE_IDS = ['fn-a1b2c3d4', 'fn-zz99yy88', 'fn-1', 'fn-x', 'note:1', 'fn-a b']

// Library ids citations point at (reference_items ids), other documents a
// documentLink points at, and block ids a cross-reference may target (some of
// which a generated document will contain).
const REFERENCE_IDS = ['refa1b2c3', 'ref9z8y7x6', 'smith2020deep', 'r-1']
const DOCUMENT_IDS = ['2Qk9cU3hEw7Lr0', 'note-1', 'doc_abc']
const CROSS_TARGETS = ['figabc123', 'eqabc12345', 'headabcdef', 'fn-a1b2c3d4', 'gone000000']

const sized = fc.option(fc.integer({ min: 1, max: 2000 }), { nil: null })

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

const maybe = <T>(arb: fc.Arbitrary<T>, weight = 1) =>
  fc.oneof({ weight: 3, arbitrary: fc.constant(null) }, { weight, arbitrary: arb })

// CONSTRAINT: link target/rel/class keep their defaults. The renderers always
// write rel="noopener noreferrer nofollow" target="_blank" (security), and
// validateContent forces class to null.
const linkMark = fc
  .record({ href: fc.constantFrom(...HREFS), title: fc.option(attrText, { nil: null }) })
  .map((attrs) => mark('link', attrs))

const nonCodeMarks = fc
  .record({
    link: maybe(linkMark),
    textStyle: maybe(fc.constantFrom(...COLORS).map((color) => mark('textStyle', { color }))),
    bold: maybe(fc.constant(mark('bold')), 2),
    italic: maybe(fc.constant(mark('italic')), 2),
    strike: maybe(fc.constant(mark('strike'))),
    underline: maybe(fc.constant(mark('underline'))),
    highlight: maybe(
      fc
        .option(fc.constantFrom(...HIGHLIGHTS), { nil: null })
        .map((color) => mark('highlight', { color }))
    ),
    superscript: maybe(fc.constant(mark('superscript'))),
    subscript: maybe(fc.constant(mark('subscript'))),
  })
  .map((set) => sortMarks(Object.values(set).filter((m): m is Mark => m !== null)))

// `code` excludes every other mark.
export const markSetArb = fc.oneof(
  { weight: 3, arbitrary: fc.constant([] as Mark[]) },
  { weight: 6, arbitrary: nonCodeMarks },
  { weight: 1, arbitrary: fc.constant<Mark[]>([mark('code')]) }
)

// ---------------------------------------------------------------------------
// Inline content
// ---------------------------------------------------------------------------

type InlineKind = (marks: Mark[]) => Json

// CONSTRAINT: pin-cite fields are non-empty strings (validateContent drops empty ones).
const pinCite = fc.option(attrText, { nil: undefined })

const citation = fc.record({
  items: fc.array(
    fc
      .record({
        id: fc.constantFrom(...REFERENCE_IDS),
        locator: pinCite,
        label: fc.option(fc.constantFrom('page', 'chapter', 'section', 'figure'), {
          nil: undefined,
        }),
        prefix: pinCite,
        suffix: pinCite,
      })
      .map((item) =>
        Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined))
      ),
    { minLength: 1, maxLength: 3 }
  ),
  mode: fc.constantFrom('normal', 'suppress-author', 'author-in-text'),
})

const documentLink = fc.record({
  documentId: fc.constantFrom(...DOCUMENT_IDS),
  blockId: fc.option(fc.constantFrom('blockabc12', 'headabcdef'), { nil: null }),
  title: fc.oneof(attrText, fc.constant('')),
})

const inlineAtom = (allowRefs: boolean): fc.Arbitrary<InlineKind> =>
  fc.oneof(
    { weight: 12, arbitrary: textArb.map((text) => (marks: Mark[]) => textNode(text, marks)) },
    { weight: 2, arbitrary: fc.constant((marks: Mark[]) => node('hardBreak', {}, [], marks)) },
    {
      weight: 2,
      arbitrary: inlineLatex.map(
        (latex) => (marks: Mark[]) =>
          node(
            'inlineMath',
            // CONSTRAINT: no backtick in TeX inside link text; marked's link
            // label scanner can't skip a code span holding one ($`…`$ form).
            { latex: marks.some((m) => m.type === 'link') ? latex.replace(/`/g, '') : latex },
            [],
            marks
          )
      ),
    },
    {
      weight: allowRefs ? 2 : 0,
      arbitrary: fc
        .constantFrom(...FOOTNOTE_IDS)
        .map((id) => (marks: Mark[]) => node('footnoteReference', { id }, [], marks)),
    },
    {
      weight: 1,
      arbitrary: citation.map((attrs) => (marks: Mark[]) => node('citation', attrs, [], marks)),
    },
    {
      weight: 1,
      arbitrary: fc
        .constantFrom(...CROSS_TARGETS)
        .map((target) => (marks: Mark[]) => node('crossReference', { target }, [], marks)),
    },
    {
      weight: 1,
      arbitrary: documentLink.map(
        (attrs) => (marks: Mark[]) => node('documentLink', attrs, [], marks)
      ),
    }
  )

function textNode(text: string, marks: Mark[]): Json {
  return marks.length > 0 ? { type: 'text', text, marks } : { type: 'text', text }
}

/**
 * A paragraph's inline content. Each item takes its marks from a small
 * per-paragraph palette, so marks run across several nodes (and across hard
 * breaks, math and footnote references) the way real formatting does.
 */
const inlineContent = (allowRefs: boolean, maxLength = 6) =>
  fc
    .record({
      palette: fc.array(markSetArb, { minLength: 1, maxLength: 3 }),
      items: fc.array(fc.tuple(fc.nat(5), inlineAtom(allowRefs)), { maxLength }),
    })
    .map(({ palette, items }) =>
      mergeText(items.map(([pick, make]) => make(palette[pick % palette.length] ?? [])))
    )

const paragraph = (allowRefs: boolean) =>
  fc
    .record({ id: blockId('paragraph'), content: inlineContent(allowRefs) })
    .map(({ id, content }) => node('paragraph', withId({}, id), content))

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const heading = fc
  .record({
    id: fc.oneof(
      { weight: 4, arbitrary: blockId('heading') },
      { weight: 1, arbitrary: fc.constant('headabcdef') }
    ),
    level: fc.integer({ min: 1, max: 6 }),
    content: inlineContent(true, 4),
  })
  .map(({ id, level, content }) => node('heading', withId({ level }, id), content))

const codeBlock = fc
  .record({
    id: blockId('codeBlock'),
    language: fc.option(fc.constantFrom(...LANGUAGES), { nil: null }),
    text: codeText,
  })
  .map(({ id, language, text }) =>
    node('codeBlock', withId({ language }, id), text ? [{ type: 'text', text }] : [])
  )

const horizontalRule = blockId('horizontalRule').map((id) => node('horizontalRule', withId({}, id)))

// CONSTRAINT: image alt is a non-empty string or null and never number-like
// (see `attrText`); published HTML writes alt="" for a missing alt.
const image = fc
  .record({
    id: blockId('image'),
    src: fc.constantFrom(...IMAGE_SRCS),
    alt: fc.option(attrText, { nil: null }),
    title: fc.option(attrText, { nil: null }),
    width: sized,
    height: sized,
  })
  .map(({ id, ...attrs }) => node('image', withId(attrs, id)))

// CONSTRAINT: start is a whole number of seconds and width/height are positive
// pixels — what the YouTube extension stores.
const youtube = fc
  .record({
    id: blockId('youtube'),
    src: fc.constantFrom(...YOUTUBE_SRCS),
    start: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 36_000 })),
    width: fc.oneof(fc.constant(640), fc.integer({ min: 1, max: 2000 })),
    height: fc.oneof(fc.constant(480), fc.integer({ min: 1, max: 2000 })),
  })
  .map(({ id, ...attrs }) => node('youtube', withId(attrs, id)))

const blockMath = fc
  .record({
    id: fc.oneof(blockId('blockMath'), fc.constant('eqabc12345')),
    latex: blockLatex,
    numbered: fc.boolean(),
    tag: fc.option(fc.constantFrom('3.2', 'A1', '7'), { nil: null }),
  })
  .map(({ id, latex, numbered, tag }) =>
    // A fixed tag only means something on a numbered equation.
    node('blockMath', withId({ latex, numbered, tag: numbered ? tag : null }, id))
  )

const figcaption = inlineContent(false, 4).map((content) => node('figcaption', {}, content))

// CONSTRAINT: a figure holds one image or one table plus its caption.
const figure = fc
  .record({
    id: fc.oneof(blockId('figure'), fc.constant('figabc123')),
    body: fc.oneof(
      { weight: 3, arbitrary: fc.constant(null) },
      { weight: 1, arbitrary: fc.constant('table') }
    ),
    image: fc.record({
      src: fc.constantFrom(...IMAGE_SRCS),
      alt: fc.option(attrText, { nil: null }),
      title: fc.option(attrText, { nil: null }),
      width: sized,
      height: sized,
    }),
    caption: figcaption,
  })
  .chain(({ id, body, image: attrs, caption }) =>
    (body === 'table'
      ? table(paragraph(false).map((p) => [p]))
      : fc.constant(node('image', withId(attrs, null)))
    ).map((content) => node('figure', withId({}, id), [content, caption]))
  )

const bibliography = fc
  .record({ id: blockId('bibliography'), title: fc.oneof(fc.constant('References'), attrText) })
  .map(({ id, title }) => node('bibliography', withId({ title }, id)))

const leafBlock = fc.oneof(
  { weight: 10, arbitrary: paragraph(true) },
  { weight: 3, arbitrary: heading },
  { weight: 2, arbitrary: codeBlock },
  { weight: 1, arbitrary: horizontalRule },
  { weight: 1, arbitrary: image },
  { weight: 1, arbitrary: youtube },
  { weight: 2, arbitrary: blockMath }
)

type Layout = { row: number; col: number; colspan: number; rowspan: number }

/** Lay cells out on a rows × cols grid; spans never overlap (a valid TableMap). */
function layoutTable(rows: number, cols: number, spans: [number, number][]): Layout[] {
  const taken = new Set<string>()
  const out: Layout[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (taken.has(`${row}:${col}`)) continue
      const [wantCols, wantRows] = spans[row * cols + col] ?? [1, 1]
      let colspan = 1
      while (colspan < wantCols && col + colspan < cols && !taken.has(`${row}:${col + colspan}`))
        colspan++
      let rowspan = 1
      const free = (r: number) =>
        Array.from({ length: colspan }, (_, i) => !taken.has(`${r}:${col + i}`)).every(Boolean)
      while (rowspan < wantRows && row + rowspan < rows && free(row + rowspan)) rowspan++
      for (let r = row; r < row + rowspan; r++)
        for (let c = col; c < col + colspan; c++) taken.add(`${r}:${c}`)
      out.push({ row, col, colspan, rowspan })
    }
  }
  return out
}

const table = (cellContent: fc.Arbitrary<Json[]>) =>
  fc
    .record({
      id: blockId('table'),
      rowIds: fc.array(blockId('tableRow'), { minLength: 3, maxLength: 3 }),
      cellIds: fc.array(blockId('tableCell'), { minLength: 9, maxLength: 9 }),
      rows: fc.integer({ min: 1, max: 3 }),
      cols: fc.integer({ min: 1, max: 3 }),
      spans: fc.oneof(
        { weight: 3, arbitrary: fc.constant([] as [number, number][]) },
        {
          weight: 1,
          arbitrary: fc.array(
            fc.tuple(fc.integer({ min: 1, max: 2 }), fc.integer({ min: 1, max: 2 })),
            { minLength: 9, maxLength: 9 }
          ),
        }
      ),
      headers: fc.constantFrom('row', 'column', 'none', 'mixed'),
      mixed: fc.array(fc.boolean(), { minLength: 9, maxLength: 9 }),
      // prosemirror-tables: a resized column stores its width on each of its
      // cells; other columns of a spanning cell hold 0; untouched cells null.
      widths: fc.oneof(
        fc.constant([null, null, null]),
        fc.array(fc.option(fc.integer({ min: 25, max: 800 }), { nil: null }), {
          minLength: 3,
          maxLength: 3,
        })
      ),
      cells: fc.array(cellContent, { minLength: 9, maxLength: 9 }),
    })
    .map(({ id, rowIds, cellIds, rows, cols, spans, headers, mixed, widths, cells }) => {
      const layout = layoutTable(rows, cols, spans)
      const content = Array.from({ length: rows }, (_, row) =>
        node(
          'tableRow',
          withId({}, rowIds[row]),
          layout
            .filter((cell) => cell.row === row)
            .map((cell) => {
              const index = cell.row * cols + cell.col
              const header =
                headers === 'row'
                  ? cell.row === 0
                  : headers === 'column'
                    ? cell.col === 0
                    : headers === 'mixed' && mixed[index] === true
              const covered = widths.slice(cell.col, cell.col + cell.colspan)
              const colwidth = covered.some((w) => w !== null) ? covered.map((w) => w ?? 0) : null
              return node(
                header ? 'tableHeader' : 'tableCell',
                withId({ colspan: cell.colspan, rowspan: cell.rowspan, colwidth }, cellIds[index]),
                cells[index]
              )
            })
        )
      )
      return node('table', withId({}, id), content)
    })

const ORDERED_TYPES = [null, '1', 'a', 'A', 'i', 'I']
type ListType = 'bulletList' | 'orderedList' | 'taskList'

const memo = new Map<string, fc.Arbitrary<Json>>()
const memoized = (key: string, build: () => fc.Arbitrary<Json>) => {
  let arb = memo.get(key)
  if (!arb) {
    arb = build()
    memo.set(key, arb)
  }
  return arb
}

/** A list whose items may nest further lists (of any kind) down to `depth`. */
function listArb(type: ListType, depth: number): fc.Arbitrary<Json> {
  return memoized(`${type}:${depth}`, () => {
    const itemType = type === 'taskList' ? 'taskItem' : 'listItem'
    const extra =
      depth > 0
        ? fc.oneof(
            { weight: 2, arbitrary: anyList(depth - 1) },
            { weight: 3, arbitrary: blockArb(depth - 1) }
          )
        : leafBlock
    const item = fc
      .record({
        id: blockId(itemType),
        checked: fc.boolean(),
        first: paragraph(true),
        rest: fc.oneof(
          { weight: 2, arbitrary: fc.constant([] as Json[]) },
          { weight: 1, arbitrary: fc.array(extra, { minLength: 1, maxLength: 2 }) }
        ),
      })
      .map(({ id, checked, first, rest }) =>
        node(itemType, withId(itemType === 'taskItem' ? { checked } : {}, id), [first, ...rest])
      )
    return fc
      .record({
        id: blockId(type),
        items: fc.array(item, { minLength: 1, maxLength: 3 }),
        // CONSTRAINT: start stays below CommonMark's 9-digit list-marker limit.
        start: fc.oneof(
          { weight: 4, arbitrary: fc.constant(1) },
          { weight: 1, arbitrary: fc.integer({ min: 0, max: 999 }) }
        ),
        listType: fc.constantFrom(...ORDERED_TYPES),
      })
      .map(({ id, items, start, listType }) =>
        node(type, withId(type === 'orderedList' ? { start, type: listType } : {}, id), items)
      )
  })
}

const anyList = (depth: number) =>
  memoized(`list:${depth}`, () =>
    fc.oneof(
      listArb('bulletList', depth),
      listArb('orderedList', depth),
      listArb('taskList', depth)
    )
  )

function blockArb(depth: number): fc.Arbitrary<Json> {
  if (depth <= 0) return leafBlock
  return memoized(`block:${depth}`, () => {
    const many = fc.array(blockArb(depth - 1), { minLength: 1, maxLength: 3 })
    return fc.oneof(
      { weight: 8, arbitrary: leafBlock },
      {
        weight: 2,
        arbitrary: fc
          .record({ id: blockId('blockquote'), content: many })
          .map(({ id, content }) => node('blockquote', withId({}, id), content)),
      },
      {
        weight: 2,
        arbitrary: fc
          .record({ id: blockId('callout'), emoji: fc.constantFrom(...EMOJI), content: many })
          .map(({ id, emoji, content }) => node('callout', withId({ emoji }, id), content)),
      },
      { weight: 5, arbitrary: anyList(depth - 1) },
      { weight: 2, arbitrary: figure },
      {
        weight: 2,
        arbitrary: table(
          fc.oneof(
            { weight: 5, arbitrary: paragraph(true).map((p) => [p]) },
            { weight: 1, arbitrary: many }
          )
        ),
      }
    )
  })
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/** Footnote reference ids in reading order (skipping the footnotes list). */
export function referenceIds(doc: Json): string[] {
  const ids: string[] = []
  const walk = (n: Json) => {
    if (n.type === 'footnotes') return
    if (n.type === 'footnoteReference' && typeof n.attrs?.id === 'string') ids.push(n.attrs.id)
    n.content?.forEach(walk)
  }
  walk(doc)
  return [...new Set(ids)]
}

// CONSTRAINT: note bodies never contain footnote references (the editor's
// syncFootnotes would orphan them), and the footnotes list holds exactly one
// note per referenced id in reference order — the invariant syncFootnotes keeps.
const footnoteBody = fc.array(paragraph(false), { minLength: 1, maxLength: 2 })

export type DocOptions = {
  depth?: number
  maxBlocks?: number
  /**
   * Marks on hardBreak / inlineMath / footnoteReference (default false: the
   * model strips them, see src/schema/unmarked.ts). True generates them, to
   * check that normalisation removes them.
   */
  atomMarks?: boolean
  /**
   * Whitespace that HTML collapses (default true). CONSTRAINT for HTML import:
   * ProseMirror's DOMParser collapses runs of spaces/tabs and strips leading
   * whitespace (block start, after a break or a space) and trailing whitespace
   * at block end, even under `white-space: pre-wrap`.
   */
  collapsibleWhitespace?: boolean
}

const INLINE_ATOMS = new Set([
  'hardBreak',
  'inlineMath',
  'footnoteReference',
  'citation',
  'crossReference',
  'documentLink',
])

/** Map every node bottom-up. */
function mapNodes(node: Json, fn: (node: Json) => Json): Json {
  const content = node.content?.map((child) => mapNodes(child, fn))
  return fn(content ? { ...node, content } : node)
}

function stripAtomMarks(node: Json): Json {
  if (!INLINE_ATOMS.has(node.type ?? '') || !node.marks) return node
  const { marks: _marks, ...rest } = node
  return rest
}

/** A textblock's inline content with only the whitespace HTML import keeps. */
function collapseWhitespace(node: Json): Json {
  if (
    (node.type !== 'paragraph' && node.type !== 'heading' && node.type !== 'figcaption') ||
    !node.content
  )
    return node
  const out: Json[] = []
  let afterSpace = true
  for (const child of node.content) {
    if (child.type !== 'text') {
      out.push(child)
      afterSpace = child.type === 'hardBreak'
      continue
    }
    let text = (child.text ?? '').replace(/[ \t\r\n\f]+/g, ' ')
    if (afterSpace && text.startsWith(' ')) text = text.slice(1)
    if (!text) continue
    afterSpace = text.endsWith(' ')
    out.push({ ...child, text })
  }
  const last = out[out.length - 1]
  if (last?.type === 'text') {
    const text = (last.text ?? '').replace(/ +$/, '')
    if (text) out[out.length - 1] = { ...last, text }
    else out.pop()
  }
  const content = mergeText(out)
  const { content: _content, ...rest } = node
  return content.length > 0 ? { ...rest, content } : rest
}

export function docArb({
  depth = 2,
  maxBlocks = 5,
  atomMarks = false,
  collapsibleWhitespace = true,
}: DocOptions = {}): fc.Arbitrary<Json> {
  const constrain = (doc: Json) =>
    mapNodes(doc, (node) => {
      let out = node
      if (!atomMarks) out = stripAtomMarks(out)
      if (!collapsibleWhitespace) out = collapseWhitespace(out)
      return out
    })
  const body = fc
    .tuple(
      fc.array(blockArb(depth), { minLength: 1, maxLength: maxBlocks }),
      fc.option(bibliography, { nil: null, freq: 4 })
    )
    .map(([blocks, bib]) => (bib ? [...blocks, bib] : blocks))
  const docs = body.chain((blocks) => {
    const ids = referenceIds(node('doc', {}, blocks))
    if (ids.length === 0) return fc.constant(node('doc', {}, blocks))
    return fc
      .record({
        notes: fc.array(footnoteBody, { minLength: ids.length, maxLength: ids.length }),
        id: blockId('footnotes'),
      })
      .map(({ notes, id }) => {
        const list = ids.map((ref, index) => node('footnote', { id: ref }, notes[index]))
        return node('doc', {}, [...blocks, node('footnotes', withId({}, id), list)])
      })
  })
  return atomMarks && collapsibleWhitespace ? docs : docs.map(constrain)
}

/** Title / subtitle pairs for the Yjs layout. */
export const fieldsArb = fc.record({ title: plainStringArb, subtitle: plainStringArb })
