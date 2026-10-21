import katex from 'katex'

import { footnoteOrder, renderToHTML } from '../render-html'
import { escapeHtml, sanitizeUrl } from '../sanitize'
import type { ContentDoc, ContentNode } from '../types'
import { positiveInt, videoUrl, xmlSafe } from './xml'

// ---------------------------------------------------------------------------
// HTML → XHTML
// ---------------------------------------------------------------------------

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])

// Named references renderers and KaTeX actually produce, plus the common
// typographic ones. XML only predefines five; the rest become characters.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  zwnj: '‌',
  zwj: '‍',
  shy: '­',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  laquo: '«',
  raquo: '»',
  lsaquo: '‹',
  rsaquo: '›',
  hellip: '…',
  bull: '•',
  middot: '·',
  dagger: '†',
  Dagger: '‡',
  prime: '′',
  Prime: '″',
  copy: '©',
  reg: '®',
  trade: '™',
  sect: '§',
  para: '¶',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  minus: '−',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  cent: '¢',
  pound: '£',
  euro: '€',
  yen: '¥',
  larr: '←',
  rarr: '→',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
  iexcl: '¡',
  iquest: '¿',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (match, body: string) => {
    if (body.startsWith('#')) {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number(body.slice(1))
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : ''
    }
    // An unknown name stays literal text (its & is escaped on output).
    return NAMED_ENTITIES[body] ?? match
  })
}

const escapeText = (text: string) =>
  xmlSafe(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeAttribute = (text: string) => escapeText(text).replace(/"/g, '&quot;')

const ATTRIBUTE_NAME = /^[A-Za-z_:][-A-Za-z0-9_.:]*$/

export type XhtmlOptions = {
  /** Rewrites or drops (null) an attribute. Called with the decoded value. */
  attribute?: (element: string, name: string, value: string) => string | null
  /** Ids already used in the file. A repeated id is dropped, so ids stay unique. */
  ids?: Set<string>
}

/**
 * Makes HTML well-formed XML: void elements self-close, every attribute gets
 * a quoted value, entities become characters, comments go, and stray or
 * missing end tags are repaired. Element and attribute names keep their case
 * (MathML and SVG are case-sensitive). Not a general HTML parser: no implied
 * end tags, and <script>/<style> contents aren't special. It is meant for the
 * output of this package's renderers and KaTeX.
 */
export function htmlToXhtml(html: string, options: XhtmlOptions = {}): string {
  let out = ''
  const stack: string[] = []
  let at = 0

  while (at < html.length) {
    const lt = html.indexOf('<', at)
    if (lt === -1) {
      out += escapeText(decodeEntities(html.slice(at)))
      break
    }
    if (lt > at) out += escapeText(decodeEntities(html.slice(at, lt)))

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      at = end === -1 ? html.length : end + 3
      continue
    }
    if (html.startsWith('<![CDATA[', lt)) {
      const end = html.indexOf(']]>', lt + 9)
      out += escapeText(html.slice(lt + 9, end === -1 ? html.length : end))
      at = end === -1 ? html.length : end + 3
      continue
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const end = html.indexOf('>', lt)
      at = end === -1 ? html.length : end + 1
      continue
    }

    const closing = html[lt + 1] === '/'
    const nameMatch = /^[A-Za-z][^\s/>]*/.exec(html.slice(lt + (closing ? 2 : 1), lt + 64))
    if (!nameMatch) {
      out += '&lt;'
      at = lt + 1
      continue
    }
    const name = nameMatch[0]
    let cursor = lt + (closing ? 2 : 1) + name.length

    if (closing) {
      const end = html.indexOf('>', cursor)
      at = end === -1 ? html.length : end + 1
      if (VOID_ELEMENTS.has(name.toLowerCase())) continue
      const index = stack.lastIndexOf(name)
      if (index === -1) continue // stray end tag
      while (stack.length > index) out += `</${stack.pop()}>`
      continue
    }

    // Attributes.
    const attributes: [string, string][] = []
    let selfClosing = false
    for (;;) {
      while (cursor < html.length && /\s/.test(html[cursor] ?? '')) cursor++
      if (cursor >= html.length) break
      if (html[cursor] === '>') {
        cursor++
        break
      }
      if (html.startsWith('/>', cursor)) {
        selfClosing = true
        cursor += 2
        break
      }
      if (html[cursor] === '/') {
        cursor++
        continue
      }
      const attrName = /^[^\s"'>/=]+/.exec(html.slice(cursor, cursor + 256))?.[0] ?? ''
      if (!attrName) {
        cursor++
        continue
      }
      cursor += attrName.length
      while (/\s/.test(html[cursor] ?? '')) cursor++
      let value = ''
      if (html[cursor] === '=') {
        cursor++
        while (/\s/.test(html[cursor] ?? '')) cursor++
        const quote = html[cursor]
        if (quote === '"' || quote === "'") {
          const end = html.indexOf(quote, cursor + 1)
          value = html.slice(cursor + 1, end === -1 ? html.length : end)
          cursor = end === -1 ? html.length : end + 1
        } else {
          let end = cursor
          while (end < html.length && html[end] !== '>' && !/\s/.test(html[end] ?? '')) end++
          value = html.slice(cursor, end)
          cursor = end
        }
      }
      attributes.push([attrName, decodeEntities(value)])
    }
    at = cursor

    let tag = `<${name}`
    const seen = new Set<string>()
    for (const [attrName, raw] of attributes) {
      if (!ATTRIBUTE_NAME.test(attrName) || seen.has(attrName)) continue
      seen.add(attrName)
      let value: string | null = raw
      if (options.attribute) value = options.attribute(name, attrName, raw)
      if (value === null) continue
      if (attrName === 'id' && options.ids) {
        if (!value || options.ids.has(value)) continue
        options.ids.add(value)
      }
      tag += ` ${attrName}="${escapeAttribute(value)}"`
    }

    if (selfClosing || VOID_ELEMENTS.has(name.toLowerCase())) {
      out += `${tag}/>`
    } else {
      out += `${tag}>`
      stack.push(name)
    }
  }

  while (stack.length > 0) out += `</${stack.pop()}>`
  return out
}

// ---------------------------------------------------------------------------
// Document → EPUB XHTML
// ---------------------------------------------------------------------------

export type XhtmlRenderOptions = {
  /** Added to every heading level, so the chapter title can be the only h1. */
  headingOffset?: number
  /**
   * Where an image's (sanitized) src should point, or null to show its alt
   * text instead. Default: unchanged.
   */
  imageSrc?: (src: string) => string | null
  /** Rewrites in-document links (`#id`), e.g. to the chapter file that holds the target. */
  fragmentHref?: (href: string) => string
  /** Ids used in the file so far; shared so the body and notes never repeat one. */
  ids?: Set<string>
}

export type XhtmlFragment = {
  /** The document's blocks. */
  body: string
  /** Its footnotes, as EPUB 3 `<aside epub:type="footnote">` elements (empty when none). */
  notes: string
  /** Contains MathML (the manifest item needs `properties="mathml"`). */
  math: boolean
  /** References remote images (the manifest item needs `properties="remote-resources"`). */
  remote: boolean
}

type State = {
  options: XhtmlRenderOptions
  nonce: string
  slots: string[]
  numbers: Map<string, number>
  notes: Map<string, ContentNode>
  /** Footnotes whose first reference carries the back-link target id. */
  anchored: Set<string>
  math: boolean
  remote: boolean
}

const TEXTBLOCKS = new Set(['paragraph', 'heading', 'figcaption', 'codeBlock'])
const SAFE_ID = /^[A-Za-z_][-A-Za-z0-9_.]{0,63}$/
const anchorId = (id: string) => id.replace(/[^\w-]/g, '')

function idAttr(node: ContentNode): string {
  const id = node.attrs?.id
  return typeof id === 'string' && SAFE_ID.test(id) ? ` id="${escapeHtml(id)}"` : ''
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** TeX → presentation MathML (KaTeX), or null when it can't be parsed. */
export function texToMathml(latex: string, display: boolean): string | null {
  try {
    const html = katex.renderToString(latex, {
      displayMode: display,
      output: 'mathml',
      throwOnError: false,
      strict: 'ignore',
    })
    const math = /<math[\s\S]*<\/math>/.exec(html)?.[0]
    if (!math) return null
    // Readers without MathML print every text node, so the TeX annotation would
    // show twice; alttext keeps the source for assistive technology instead.
    return math
      .replace(/<annotation encoding="application\/x-tex">[\s\S]*?<\/annotation>/g, '')
      .replace(/^<math\b/, `<math alttext="${escapeHtml(latex)}"`)
  } catch {
    return null
  }
}

function mathMarkup(latex: string, display: boolean, state: State): string {
  const math = texToMathml(latex, display)
  if (!math) return `<code class="math-source">${escapeHtml(latex)}</code>`
  state.math = true
  return math
}

function slot(state: State, markup: string): string {
  state.slots.push(markup)
  return `${state.nonce}.${state.slots.length - 1}`
}

const blockSlot = (state: State, markup: string): ContentNode => ({
  type: 'paragraph',
  content: [{ type: 'text', text: slot(state, markup) }],
})

const inlineSlot = (state: State, markup: string, node: ContentNode): ContentNode => ({
  type: 'text',
  text: slot(state, markup),
  marks: node.marks ?? null,
})

const hasLink = (node: ContentNode) =>
  (node.marks ?? []).some((mark) => mark.type === 'link' && sanitizeUrl(mark.attrs?.href))

function noteref(node: ContentNode, state: State): string {
  const id = text(node.attrs?.id)
  const number = state.numbers.get(id)
  if (!number) return ''
  // An <a> can't sit inside a link, and a note without a body has nowhere to go.
  if (hasLink(node) || !state.notes.has(id)) return `<sup class="noteref">${number}</sup>`
  const anchor = anchorId(id)
  const first = !state.anchored.has(id)
  state.anchored.add(id)
  return `<sup class="noteref"><a epub:type="noteref" role="doc-noteref" href="#fn-${anchor}"${
    first ? ` id="fnref-${anchor}"` : ''
  }>${number}</a></sup>`
}

function imageMarkup(node: ContentNode, state: State): string {
  const alt = text(node.attrs?.alt)
  const original = sanitizeUrl(node.attrs?.src, { allowData: true })
  const src = original
    ? state.options.imageSrc
      ? state.options.imageSrc(original)
      : original
    : null
  if (!src) return alt ? `<span class="image-alt">[${escapeHtml(alt)}]</span>` : ''
  if (/^https?:/i.test(src)) state.remote = true
  const width = positiveInt(node.attrs?.width)
  const height = positiveInt(node.attrs?.height)
  const title = text(node.attrs?.title)
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${width ? ` width="${width}"` : ''}${
    height ? ` height="${height}"` : ''
  }${title ? ` title="${escapeHtml(title)}"` : ''}/>`
}

function videoMarkup(node: ContentNode): string {
  const url = videoUrl(node)
  if (!url) return ''
  const label = url.replace(/^https?:\/\/(www\.)?/, '')
  return `<p class="video-link">Video: <a href="${escapeHtml(url)}">${escapeHtml(label)}</a></p>`
}

/** "Figure 3." before a caption; no added full stop if the label has its own punctuation. */
function captionLabel(label: string, hasCaption: boolean): string {
  if (!label) return ''
  const punctuated = hasCaption && !/[.:;!?]$/.test(label) ? `${label}.` : label
  return `<span class="figure-label">${escapeHtml(punctuated)}</span>${hasCaption ? ' ' : ''}`
}

function figureMarkup(node: ContentNode, state: State): string {
  const label = text(node.attrs?.label).trim()
  const children = node.content ?? []
  let captioned = false
  const parts = children.map((child) => {
    if (child.type === 'figcaption') {
      captioned = true
      const caption = renderInline(child.content ?? [], state)
      return `<figcaption>${captionLabel(label, caption.trim() !== '')}${caption}</figcaption>`
    }
    if (child.type === 'image') return imageMarkup(child, state)
    return renderBlocks([child], state)
  })
  if (!captioned && label) parts.push(`<figcaption>${captionLabel(label, false)}</figcaption>`)
  return `<figure class="figure"${idAttr(node)}>${parts.join('')}</figure>`
}

function equationMarkup(node: ContentNode, state: State): string {
  const label = text(node.attrs?.label).trim()
  // The label floats right, so it comes first.
  return `<div class="equation"${idAttr(node)}>${
    label ? `<span class="equation-label">${escapeHtml(label)}</span>` : ''
  }<div class="equation-math">${mathMarkup(text(node.attrs?.latex), true, state)}</div></div>`
}

/**
 * Swaps the nodes EPUB renders differently for placeholder text, so the rest
 * of the document still goes through renderToHTML (and picks up whatever it
 * learns to render later).
 */
function lower(node: ContentNode, state: State, inline: boolean): ContentNode[] {
  switch (node.type) {
    case 'footnotes':
      return [] // rendered as asides after the body
    case 'footnoteReference':
      return [inlineSlot(state, noteref(node, state), node)]
    case 'blockMath':
      return [blockSlot(state, equationMarkup(node, state))]
    case 'image': {
      const markup = imageMarkup(node, state)
      if (inline) return [inlineSlot(state, markup, node)]
      return markup ? [blockSlot(state, `<div class="image">${markup}</div>`)] : []
    }
    case 'youtube':
    case 'iframe': {
      const markup = videoMarkup(node)
      return markup ? [blockSlot(state, markup)] : []
    }
    case 'figure':
      return [blockSlot(state, figureMarkup(node, state))]
    case 'figcaption':
      return [blockSlot(state, `<p class="caption">${renderInline(node.content ?? [], state)}</p>`)]
    case 'heading': {
      const level = Number(node.attrs?.level ?? 1) || 1
      const shifted = Math.min(
        6,
        Math.max(1, Math.round(level) + (state.options.headingOffset ?? 0))
      )
      return [
        { ...node, attrs: { ...node.attrs, level: shifted }, content: lowerChildren(node, state) },
      ]
    }
    default:
      return node.content ? [{ ...node, content: lowerChildren(node, state) }] : [node]
  }
}

function lowerChildren(node: ContentNode, state: State): ContentNode[] {
  const children = node.content ?? []
  const inline = TEXTBLOCKS.has(node.type ?? '') || children.some((child) => child.type === 'text')
  return children.flatMap((child) => lower(child, state, inline))
}

function render(doc: ContentNode, state: State): string {
  const html = renderToHTML(
    { type: 'doc', content: lowerChildren(doc, state) },
    {
      renderMath: (latex, display) => {
        const math = texToMathml(latex, display)
        if (math) state.math = true
        return math
      },
    }
  )
  const token = new RegExp(
    `<p>\\uE000${state.nonce}\\.(\\d+)\\uE001</p>|\\uE000${state.nonce}\\.(\\d+)\\uE001`,
    'g'
  )
  return html.replace(
    token,
    (_match, block?: string, inline?: string) => state.slots[Number(block ?? inline)] ?? ''
  )
}

const renderBlocks = (nodes: ContentNode[], state: State) =>
  render({ type: 'doc', content: nodes }, state)

function renderInline(nodes: ContentNode[], state: State): string {
  const html = renderBlocks([{ type: 'paragraph', content: nodes }], state)
  return html.replace(/^<p>/, '').replace(/<\/p>$/, '')
}

function renderNotes(state: State): string {
  const asides: string[] = []
  for (const [id, number] of state.numbers) {
    const note = state.notes.get(id)
    if (!note) continue
    const anchor = anchorId(id)
    const label = state.anchored.has(id)
      ? `<a class="note-number" href="#fnref-${anchor}">${number}.</a> `
      : `<span class="note-number">${number}.</span> `
    const body = renderBlocks(note.content ?? [], state)
    // The number goes inside the first paragraph so it doesn't take a line.
    const opening = /^<p(\s[^>]*)?>/.exec(body)
    const withLabel = opening
      ? `${opening[0]}${label}${body.slice(opening[0].length)}`
      : `<p>${label}</p>${body}`
    asides.push(
      `<aside epub:type="footnote" role="doc-footnote" class="footnote" id="fn-${anchor}">${withLabel}</aside>`
    )
  }
  return asides.join('\n')
}

// Presentational or embed-only attributes that have no place in an EPUB.
const DROPPED_ATTRIBUTES = new Set([
  'colwidth',
  'target',
  'loading',
  'decoding',
  'frameborder',
  'allow',
  'allowfullscreen',
])

/**
 * Renders a document's body and footnotes as EPUB XHTML fragments: MathML
 * for math, `epub:type="noteref"` links to `<aside epub:type="footnote">`
 * notes (Apple Books shows them as pop-ups), figures with captions, videos as
 * links, and images pointed wherever `imageSrc` says.
 */
export function renderXhtml(
  doc: ContentDoc | null | undefined,
  options: XhtmlRenderOptions = {}
): XhtmlFragment {
  const source: ContentNode = doc ?? { type: 'doc', content: [] }
  const notes = new Map<string, ContentNode>()
  for (const block of source.content ?? []) {
    if (block.type !== 'footnotes') continue
    for (const note of block.content ?? []) {
      const id = text(note.attrs?.id)
      if (id && !notes.has(id)) notes.set(id, note)
    }
  }
  const state: State = {
    options,
    nonce: Math.random().toString(36).slice(2, 10),
    slots: [],
    numbers: footnoteOrder(source),
    notes,
    anchored: new Set(),
    math: false,
    remote: false,
  }
  const ids = options.ids ?? new Set<string>()
  const xhtml = (html: string) =>
    htmlToXhtml(html, {
      ids,
      attribute: (element, name, value) => {
        if (DROPPED_ATTRIBUTES.has(name)) return null
        // Pixel widths from the editor don't fit a phone; the stylesheet sizes tables.
        if (name === 'style' && (element === 'table' || element === 'col')) return null
        if (name === 'href' && value.startsWith('#') && options.fragmentHref) {
          return options.fragmentHref(value)
        }
        return value
      },
    })
  const body = xhtml(render(source, state))
  const notesHtml = xhtml(renderNotes(state))
  return { body, notes: notesHtml, math: state.math, remote: state.remote }
}
