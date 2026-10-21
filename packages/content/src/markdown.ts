import { numberDocument, type Target } from './numbering'
import { footnoteOrder, youtubeVideoId } from './render-html'
import { escapeHtml, sanitizeUrl } from './sanitize'
import type { ContentDoc, ContentMark, ContentNode } from './types'

/**
 * JSON → GitHub-flavoured Markdown, for export, the API and AI tooling, and
 * the inverse of markdownToContent: everything Markdown can carry comes back
 * exactly (covered by test/roundtrip.property.test.ts).
 *
 * Never emits presentational HTML. Where Markdown has no syntax:
 *   callout → blockquote led by its emoji · YouTube → [Video](url) link
 *   sup/sub → <sup>/<sub> · math → $…$ / $$…$$ · footnotes → [^n] + definitions
 *   bold/italic/strike that CommonMark's delimiter rules can't express (e.g.
 *   **"quoted"** glued to a word) → <strong>/<em>/<s>
 * and the rest is dropped and reported by markdownLoss(): colour, highlight,
 * underline, empty paragraphs, table layout, image/video sizes (see LOSSES).
 */

export type MarkdownLossFeature =
  | 'textColor'
  | 'highlight'
  | 'underline'
  | 'emptyParagraph'
  | 'emptyMath'
  | 'mathLineBreak'
  | 'orderedListType'
  | 'imageSize'
  | 'videoStartTime'
  | 'videoSize'
  | 'tableColumnWidth'
  | 'tableCellSpan'
  | 'tableHeaders'
  | 'tableCellBlocks'
  | 'tableMathPipe'
  | 'trailingSpace'
  | 'figure'
  | 'equationNumber'
  | 'citation'
  | 'bibliography'
  | 'crossReference'
  | 'documentLink'

/** One kind of content Markdown can't carry, and how many times the export dropped it. */
export type MarkdownLoss = { feature: MarkdownLossFeature; count: number; description: string }

export type MarkdownOptions = {
  /** Called once with everything the export dropped (empty when lossless). */
  onLoss?: (losses: MarkdownLoss[]) => void
  /**
   * 'pandoc' writes Pandoc/Quarto Markdown: citations as [@key], figures,
   * tables and numbered equations with {#fig-…}/{#tbl-…}/{#eq-…} labels,
   * cross-references as @fig-… and the bibliography as a #refs div.
   */
  flavor?: 'gfm' | 'pandoc'
  /** The citation key for a reference id (Pandoc flavour). Defaults to the id. */
  citationKey?: (id: string) => string
}

const LOSSES: Record<MarkdownLossFeature, string> = {
  textColor: 'text colour (runs of coloured text)',
  highlight: 'highlights (runs of highlighted text)',
  underline: 'underline (runs of underlined text)',
  emptyParagraph: 'empty paragraphs',
  emptyMath: 'inline equations with no TeX',
  mathLineBreak: 'line breaks in inline TeX (written as spaces)',
  orderedListType: 'numbering styles of ordered lists (a, A, i, I)',
  imageSize: 'image width/height',
  videoStartTime: 'video start times',
  videoSize: 'video width/height',
  tableColumnWidth: 'table column widths (tables)',
  tableCellSpan: 'merged table cells (colspan/rowspan)',
  tableHeaders: 'header cells outside the first row, or body cells in it',
  tableCellBlocks: 'table cells with more than one paragraph, flattened to one line',
  tableMathPipe: 'TeX \\| in table cells (GFM reads it as |)',
  trailingSpace: 'spaces at the end of a paragraph, heading or cell',
  figure: 'figure numbers (captions are kept as paragraphs)',
  equationNumber: 'equation numbers',
  citation: 'citations (use the Pandoc export to keep them)',
  bibliography: 'the bibliography (use the Pandoc export to keep it)',
  crossReference: 'cross-reference links (their text is kept)',
  documentLink: 'links to other documents (their titles are kept)',
}

type Context = {
  footnotes: Map<string, number>
  loss: Map<MarkdownLossFeature, number>
  /** Inside a list item, where marked turns every tab into spaces. */
  inList: boolean
  /** Write bold/italic/strike as tags in this inline context (see exposesDelimiters). */
  tagsOnly?: boolean
  pandoc: boolean
  targets: Map<string, Target>
  /** Ids some cross-reference points at. */
  referenced: Set<string>
  citationKey: (id: string) => string
}

const lose = (ctx: Context, feature: MarkdownLossFeature, count = 1) => {
  if (count > 0) ctx.loss.set(feature, (ctx.loss.get(feature) ?? 0) + count)
}

const getAttr = <T = unknown>(node: ContentNode, key: string) => node.attrs?.[key] as T | undefined

function positiveInt(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

// ---------------------------------------------------------------------------
// Text escaping
// ---------------------------------------------------------------------------

/**
 * One emoji: flags, keycaps, skin tones, ZWJ and tag sequences. A blockquote
 * whose first paragraph starts with one (then a space) reads back as a callout.
 */
export const LEADING_EMOJI =
  /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F|[\u{E0020}-\u{E007F}])*(?:\u200D\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F)*)*)/u

const entity = (char: string) => `&#${char.codePointAt(0)};`

// Characters marked can't take literally: it expands tabs inside list items,
// and its regexes treat U+2028/U+2029 as line breaks.
const RAW_UNSAFE = /[\t\u2028\u2029]/g
const HAS_RAW_UNSAFE = /[\t\u2028\u2029]/

// Characters that start Markdown syntax anywhere in a line, plus what GFM
// would autolink (https://, www., a@b.co; marked does even mid-word) and
// HTML entities (&amp;).
function escapeText(text: string): string {
  return text
    .replace(/[\\`*_[\]<>|~$]/g, '\\$&')
    .replace(/&(?=#?[a-z0-9]+;)/gi, '\\&')
    .replace(RAW_UNSAFE, entity)
    .replace(/(https?|ftp):(?=\/\/)/gi, '$1\\:')
    .replace(/(www)\./gi, '$1\\.')
    .replace(/@(?=[a-z0-9_-]+\.)/gi, '\\@')
}

// Block syntax only matters at the start of a line (`:` for a table
// delimiter row like ":---:" under another line).
function escapeLineStart(line: string): string {
  return line.replace(/^[#>+\-=:]/, '\\$&').replace(/^(\d{1,9})([.)])/, '$1\\$2')
}

// Markdown strips spaces and tabs at the edges of a line (four leading spaces
// even make a code block); entities survive that.
const encodeLeadingSpace = (text: string) =>
  text.replace(/^\s+/u, (space) => [...space].map(entity).join(''))
const encodeTrailingSpace = (text: string) =>
  text.replace(/\s+$/u, (space) => [...space].map(entity).join(''))

// marked unescapes \[ and \] in link and image text before parsing it again
// (blind to an escaped backslash before them): use entities for all three.
const bracketEntities = (escaped: string) =>
  escaped.replace(/\\([\\[\]])/g, (_, char: string) => entity(char))

const ODD_BACKSLASH_END = /(?:^|[^\\])(?:\\\\)*\\$/
const ODD_BACKSLASH_TICK = /(?:^|[^\\])(?:\\\\)*\\`/

function codeSpan(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length))
  const fence = '`'.repeat(longest + 1)
  // A backtick at either end would merge with the fence, and CommonMark strips
  // one space from each end when both ends have one: pad both cases. Pad a
  // trailing backslash too: marked takes `\`` for an escape when masking.
  const edgeSpaces = text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)
  const pad =
    text.startsWith('`') || text.endsWith('`') || edgeSpaces || ODD_BACKSLASH_END.test(text)
      ? ' '
      : ''
  return `${fence}${pad}${text}${pad}${fence}`
}

// A code span can't hold an entity, so characters marked can't take raw need
// <code>; so does | in a cell (GFM unescapes \| even inside code spans), and
// \` (marked masks it as an escape, mispairing the backticks around it).
function inlineCode(text: string, mode: InlineMode): string {
  const tag =
    HAS_RAW_UNSAFE.test(text) ||
    (mode === 'cell' && text.includes('|')) ||
    ODD_BACKSLASH_TICK.test(text)
  return tag ? `<code>${escapeText(text)}</code>` : codeSpan(text)
}

// Parentheses are escaped too: marked's emphasis pass only skips links whose
// destination and title have balanced ones.
function linkDestination(url: string, pointy = false): string {
  const escaped = url.replace(/[\\()]/g, '\\$&').replace(/&(?=#?[a-z0-9]+;)/gi, '\\&')
  return pointy || /[\s()<>]/.test(url) || url === ''
    ? `<${escaped.replace(/[<>]/g, '\\$&')}>`
    : escaped
}

const linkTitle = (title: unknown) =>
  typeof title === 'string'
    ? ` "${title
        .replace(/["\\()]/g, '\\$&')
        .replace(/&(?=#?[a-z0-9]+;)/gi, '&#38;')
        .replace(RAW_UNSAFE, entity)}"`
    : ''

const YOUTUBE_URL =
  /^https?:\/\/(?:(?:www|m|music)\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)/i

// ---------------------------------------------------------------------------
// Inline content
// ---------------------------------------------------------------------------

const DROPPED_MARKS: Partial<Record<string, MarkdownLossFeature>> = {
  textStyle: 'textColor',
  highlight: 'highlight',
  underline: 'underline',
}

type InlineMode = 'paragraph' | 'heading' | 'cell'

/** How a mark is written: CommonMark delimiters, or the HTML tag fallback. */
type Pair = { mark: ContentMark; html: boolean; start: number; end: number }
type Token = { text: string; pair?: Pair; open?: boolean; hardBreak?: boolean }

const DELIMITER: Record<string, string> = { bold: '**', italic: '*', strike: '~~' }
// Equal-length marks nest in this order: tags outside, delimiters inside, where
// their neighbours are punctuation (`[`, `>`) that CommonMark flanking accepts.
const NESTING = ['link', 'superscript', 'subscript', 'code', 'bold', 'italic', 'strike']
const TAG: Record<string, string> = {
  bold: 'strong',
  italic: 'em',
  strike: 's',
  superscript: 'sup',
  subscript: 'sub',
  code: 'code',
}

function openText(pair: Pair): string {
  if (pair.mark.type === 'link') return '['
  if (!pair.html && DELIMITER[pair.mark.type]) return DELIMITER[pair.mark.type] ?? ''
  return `<${TAG[pair.mark.type] ?? 'span'}>`
}

function closeText(pair: Pair, pointy: boolean): string {
  if (pair.mark.type === 'link') {
    const href = sanitizeUrl(pair.mark.attrs?.href) ?? ''
    return `](${linkDestination(href, pointy)}${linkTitle(pair.mark.attrs?.title)})`
  }
  if (!pair.html && DELIMITER[pair.mark.type]) return DELIMITER[pair.mark.type] ?? ''
  return `</${TAG[pair.mark.type] ?? 'span'}>`
}

const sameMark = (a: ContentMark, b: ContentMark) =>
  a.type === b.type && JSON.stringify(a.attrs ?? null) === JSON.stringify(b.attrs ?? null)
const sameMarks = (a: ContentMark[], b: ContentMark[]) =>
  a.length === b.length && a.every((mark, i) => b[i] !== undefined && sameMark(mark, b[i]))

const isSpace = (char: string | undefined) => char === undefined || /\s/u.test(char)
// For `*`, marked's GFM mode counts `~` as a letter, not punctuation.
const isPunct = (char: string | undefined, delimiter: string) =>
  char !== undefined && /[\p{P}\p{S}]/u.test(char) && !(delimiter === '*' && char === '~')

// A pipe after an odd run of backslashes: GFM unescapes it in a table cell.
const ODD_PIPE = /(?<!\\)(?:\\\\)*\\\|/
// A pipe after an even run (or none) still splits a GFM table row.
const BARE_PIPE = /(?<!\\)((?:\\\\)*)\|/g

/** Inline TeX can't hold a line break (as in TeX, a space does the same). */
const inlineTex = (latex: string) => latex.replace(/\n/g, ' ')

/**
 * `$tex$`, or GitLab's `` $`tex`$ `` when the TeX has characters marked would
 * read as emphasis, links or HTML (it doesn't skip `$…$` when pairing `*`),
 * spaces at either end, or a trailing backslash (which would escape the `$`).
 */
function mathMarkdown(tex: string): string {
  const plain =
    /^[^\s*_~[\]<>`$][^*_~[\]<>`$]*$/.test(tex) && !/\s$/.test(tex) && !ODD_BACKSLASH_END.test(tex)
  return plain ? `$${tex}$` : `$${codeSpan(tex)}$`
}

/** Lossy marks count once per run of consecutive nodes carrying them. */
function countDroppedMarks(nodes: ContentNode[], ctx: Context): void {
  for (const [type, feature] of Object.entries(DROPPED_MARKS)) {
    let inRun = false
    for (const node of nodes) {
      const has = (node.marks ?? []).some((mark) => mark.type === type)
      if (has && !inRun) lose(ctx, feature as MarkdownLossFeature)
      inRun = has
    }
  }
}

function inline(block: ContentNode, ctx: Context, mode: InlineMode = 'paragraph'): string {
  const all = block.content ?? []
  countDroppedMarks(all, ctx)

  // What each node writes, before marks. Empty TeX has no Markdown form.
  const items: { node: ContentNode; text: string; marks: ContentMark[] }[] = []
  for (const node of all) {
    if (node.type === 'inlineMath' || node.type === 'math') {
      const latex = String(getAttr(node, 'latex') ?? '')
      if (!latex) {
        lose(ctx, 'emptyMath')
        continue
      }
      if (inlineTex(latex) !== latex) lose(ctx, 'mathLineBreak')
    }
    if (node.type === 'footnoteReference' && !ctx.footnotes.get(getAttr<string>(node, 'id') ?? ''))
      continue
    const marks = (node.marks ?? []).filter((mark) => !DROPPED_MARKS[mark.type])
    // Dropping a node or a mark can leave text runs that now match: one node.
    const last = items[items.length - 1]
    if (node.type === 'text' && last?.node.type === 'text' && sameMarks(last.marks, marks)) {
      last.node = { ...last.node, text: `${last.node.text ?? ''}${node.text ?? ''}` }
      continue
    }
    items.push({ node, text: '', marks })
  }

  // Spaces at the very end of a block are a typing artefact Markdown ignores;
  // drop them rather than write them as &#32;. (Kept, as entities, when they
  // are all the block holds.)
  const last = items[items.length - 1]
  if (last?.node.type === 'text') {
    const raw = last.node.text ?? ''
    const trimmed = raw.replace(/ +$/, '')
    if (trimmed !== raw && (trimmed !== '' || items.length > 1)) {
      lose(ctx, 'trailingSpace')
      if (trimmed === '') items.pop()
      else last.node = { ...last.node, text: trimmed }
    }
  }

  items.forEach((item, index) => {
    const { node } = item
    // Headings and cells are one line: <br> doesn't end it.
    const breaks = mode === 'paragraph'
    const lineStart = index === 0 || (breaks && items[index - 1]?.node.type === 'hardBreak')
    const lineEnd =
      index === items.length - 1 || (breaks && items[index + 1]?.node.type === 'hardBreak')
    switch (node.type) {
      case 'text': {
        const raw = node.text ?? ''
        if (item.marks.some((mark) => mark.type === 'code')) {
          item.text = inlineCode(raw, mode)
          break
        }
        let text = escapeText(raw)
        if (item.marks.some((mark) => mark.type === 'link')) text = bracketEntities(text)
        if (lineStart) text = encodeLeadingSpace(text)
        if (lineEnd) text = encodeTrailingSpace(text)
        // `$x$5` isn't math (so "$5 and $10" stays money): keep the digit apart.
        const previous = items[index - 1]?.node.type
        if (/^\d/.test(text) && (previous === 'math' || previous === 'inlineMath'))
          text = entity(text[0] ?? '') + text.slice(1)
        // `[^1](x)` would be a link and `[^1]:` a definition.
        if (previous === 'footnoteReference') text = text.replace(/^[(:]/, '\\$&')
        item.text = text
        break
      }
      case 'hardBreak':
        // Headings and cells are one line; in a paragraph see serializeMarks.
        item.text = breaks ? '\\\n' : '<br>'
        break
      case 'math':
      case 'inlineMath': {
        const tex = inlineTex(String(getAttr(node, 'latex') ?? ''))
        if (mode === 'cell' && ODD_PIPE.test(tex)) lose(ctx, 'tableMathPipe')
        item.text = mathMarkdown(tex)
        break
      }
      case 'footnoteReference':
        item.text = `[^${ctx.footnotes.get(getAttr<string>(node, 'id') ?? '')}]`
        break
      case 'citation':
        item.text = pandocCitation(node, ctx)
        break
      case 'crossReference':
        item.text = pandocReference(node, ctx)
        break
      default:
        item.text = inline(node, ctx, mode)
    }
  })

  return serializeMarks(items, ctx.tagsOnly || exposesDelimiters(all))
}

/**
 * marked's emphasis pass can't skip a $`…`$ whose TeX holds a backtick, or a
 * link whose text holds [^n]; delimiters inside would pair with ours, so that
 * inline context gets tags instead.
 */
function exposesDelimiters(nodes: ContentNode[]): boolean {
  return nodes.some((node) => {
    if (node.type === 'footnoteReference')
      return (node.marks ?? []).some((mark) => mark.type === 'link')
    if (/^(?:math|inlineMath|blockMath)$/.test(node.type ?? ''))
      return String(getAttr(node, 'latex') ?? '').includes('`')
    return exposesDelimiters(node.content ?? [])
  })
}

/**
 * Wrap runs of nodes in their marks, longest-running mark outermost, then
 * write each bold/italic/strike as a CommonMark delimiter only where the
 * delimiter-run rules will read it back exactly; elsewhere as an HTML tag.
 */
function serializeMarks(
  items: { node: ContentNode; text: string; marks: ContentMark[] }[],
  tagsOnly = false
): string {
  const tokens: Token[] = []
  const stack: Pair[] = []
  const pairs: Pair[] = []

  // How many consecutive nodes from `index` carry `mark`.
  const extent = (mark: ContentMark, index: number) => {
    let end = index
    while (end < items.length && items[end]?.marks.some((m) => sameMark(m, mark))) end++
    return end - index
  }

  items.forEach((item, index) => {
    // Code on text is a code span; on a break, math or reference it's <code>.
    const marks =
      item.node.type === 'text' ? item.marks.filter((mark) => mark.type !== 'code') : item.marks
    let keep = 0
    for (const pair of stack) {
      if (!marks.some((mark) => sameMark(mark, pair.mark))) break
      keep++
    }
    while (stack.length > keep) {
      const pair = stack.pop() as Pair
      tokens.push({ text: '', pair, open: false })
    }
    const fresh = marks
      .filter((mark) => !stack.some((pair) => sameMark(pair.mark, mark)))
      .map((mark) => ({ mark, length: extent(mark, index) }))
      .sort(
        (a, b) => b.length - a.length || NESTING.indexOf(a.mark.type) - NESTING.indexOf(b.mark.type)
      )
    for (const { mark } of fresh) {
      const pair: Pair = { mark, html: tagsOnly, start: 0, end: 0 }
      pairs.push(pair)
      stack.push(pair)
      tokens.push({ text: '', pair, open: true })
    }
    tokens.push({ text: item.text, hardBreak: item.text === '\\\n' })
  })
  while (stack.length > 0) tokens.push({ text: '', pair: stack.pop() as Pair, open: false })

  // "!" right before a link's "[" would make it an image.
  tokens.forEach((token, index) => {
    const next = tokens[index + 1]
    if (!token.pair && next?.open && next.pair?.mark.type === 'link' && token.text.endsWith('!'))
      token.text = `${token.text.slice(0, -1)}\\!`
  })

  // A backslash break needs more content after it in the same span (link
  // text, emphasis, paragraph); otherwise it's a literal backslash. Nor may it
  // leave a line that is only "<br>" (in a list item that's an HTML block).
  for (let index = tokens.length - 1; index >= 0; index--) {
    const token = tokens[index]
    const next = tokens[index + 1]
    if (!token?.hardBreak) continue
    if (!next || (next.pair && !next.open) || (next.hardBreak && next.text === '<br>'))
      token.text = '<br>'
  }

  // A link to YouTube alone in its paragraph is how an embed is written; the
  // <…> destination form marks a plain link as plain.
  const pointyLinks = new Set<Pair>(
    pairs.filter(
      (pair) => pair.mark.type === 'link' && YOUTUBE_URL.test(String(pair.mark.attrs?.href ?? ''))
    )
  )

  const render = () => {
    let out = ''
    for (const token of tokens) {
      if (token.pair) {
        const text = token.open
          ? openText(token.pair)
          : closeText(token.pair, pointyLinks.has(token.pair))
        if (token.open) token.pair.start = out.length
        out += text
        if (!token.open) token.pair.end = out.length
        token.text = text
      } else {
        out += token.text
      }
    }
    return out
  }

  // Flip delimiter pairs to HTML until every remaining delimiter run is
  // unambiguous: it belongs to one pair, and is left-flanking-only (opener) or
  // right-flanking-only (closer) in CommonMark's terms.
  for (;;) {
    const out = render()
    const bad = invalidPair(tokens, out)
    if (!bad) return out
    bad.html = true
  }
}

function invalidPair(tokens: Token[], out: string): Pair | null {
  let offset = 0
  const spans = tokens.map((token) => {
    const span = { token, from: offset, to: offset + token.text.length }
    offset = span.to
    return span
  })
  for (let i = 0; i < spans.length; ) {
    const first = spans[i]
    const char = first?.token.pair && !first.token.pair.html && delimiterChar(first.token.pair)
    if (!first || !char) {
      i++
      continue
    }
    // The run: adjacent delimiter tokens of the same character.
    let j = i
    while (j + 1 < spans.length) {
      const next = spans[j + 1]
      if (!next) break
      if (next.token.text === '' && !next.token.pair) {
        j++
        continue
      }
      const nextChar = next.token.pair && !next.token.pair.html && delimiterChar(next.token.pair)
      if (nextChar !== char) break
      j++
    }
    const run = spans.slice(i, j + 1).filter((span) => span.token.pair)
    // Whole code points: an emoji next to a delimiter is punctuation. marked
    // masks escaped punctuation as "++" first, so an escaped `~` is punctuation.
    let before = [...out.slice(Math.max(0, first.from - 2), first.from)].pop()
    if (before === '~' && ODD_BACKSLASH_END.test(out.slice(0, first.from - 1))) before = '+'
    const end = spans[j]?.to ?? 0
    const after = end < out.length ? String.fromCodePoint(out.codePointAt(end) ?? 0) : undefined
    const opens = run.every((span) => span.token.open)
    const closes = run.every((span) => !span.token.open)
    const punct = (c: string | undefined) => isPunct(c, char)
    const left = !isSpace(after) && (!punct(after) || isSpace(before) || punct(before))
    const right = !isSpace(before) && (!punct(before) || isSpace(after) || punct(after))
    // One pair per run: marked doesn't share `***` between bold and italic the
    // way CommonMark does.
    const ok = run.length === 1 && ((opens && left && !right) || (closes && right && !left))
    if (!ok) {
      // Flip the shortest pair touching the run.
      const candidates = run.map((span) => span.token.pair as Pair)
      candidates.sort((a, b) => a.end - a.start - (b.end - b.start))
      return candidates[0] ?? null
    }
    i = j + 1
  }
  return null
}

const delimiterChar = (pair: Pair) => {
  const delimiter = DELIMITER[pair.mark.type]
  return delimiter ? delimiter[0] : null
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

function indent(text: string, prefix: string, first = prefix): string {
  return text
    .split('\n')
    .map((line, index) => (index === 0 ? first : line ? prefix : prefix.trimEnd()) + line)
    .join('\n')
}

function paragraph(node: ContentNode, ctx: Context): string {
  return inline(node, ctx).split('\n').map(escapeLineStart).join('\n')
}

function image(node: ContentNode, ctx: Context): string {
  const src = sanitizeUrl(getAttr(node, 'src'), { allowData: true })
  if (!src) return ''
  if (getAttr(node, 'width') != null || getAttr(node, 'height') != null) lose(ctx, 'imageSize')
  const alt = bracketEntities(escapeText(String(getAttr(node, 'alt') ?? '')))
  return `![${alt}](${linkDestination(src)}${linkTitle(getAttr(node, 'title'))})`
}

type ListFamily = 'bullet' | 'ordered'
const listFamily = (node: ContentNode): ListFamily | null =>
  node.type === 'orderedList'
    ? 'ordered'
    : node.type === 'bulletList' || node.type === 'taskList'
      ? 'bullet'
      : null

function renderList(node: ContentNode, outer: Context, alternate: boolean): string {
  const ctx: Context = { ...outer, inList: true }
  const ordered = node.type === 'orderedList'
  if (ordered && getAttr(node, 'type') != null) lose(ctx, 'orderedListType')
  const start = Number(getAttr(node, 'start') ?? 1)
  const first = Number.isFinite(start) ? Math.round(start) : 1
  // Two lists in a row merge unless the marker changes.
  const bullet = alternate ? '*' : '-'
  const delimiter = alternate ? ')' : '.'
  return (node.content ?? [])
    .map((item, index) => {
      let marker = ordered ? `${first + index}${delimiter} ` : `${bullet} `
      if (item.type === 'taskItem')
        marker = `${bullet} [${getAttr(item, 'checked') === true ? 'x' : ' '}] `
      // The first paragraph is required, so an empty one comes back by itself,
      // except that a list item's next paragraph would take its place.
      const [lead, ...rest] = item.content ?? []
      const task = item.type === 'taskItem'
      let leadText = lead ? block(lead, ctx, false) : ''
      const tail = renderedBlocks(rest, ctx, { refill: false })
      if (!leadText && !task && tail[0]?.node.type === 'paragraph') {
        lose(ctx, 'emptyParagraph')
        leadText = tail.shift()?.text ?? ''
      }
      // Nested lists hug their parent line when they can interrupt a paragraph
      // ("- x", "1. x"; not "-" or "5. x"); other blocks need a blank line,
      // except right after a bare "-" (a blank line there ends the item).
      const body =
        leadText +
        tail
          .map(({ node: child, text }, i) => {
            // A lone "<br>" line opens an HTML block that runs to a blank line.
            const previous = i === 0 ? leadText : tail[i - 1]?.text
            const hug =
              (listFamily(child) && /^(?:[-*]|1[.)]) \S/.test(text) && previous !== '<br>') ||
              (i === 0 && !leadText && !task)
            return (hug ? '\n' : '\n\n') + text
          })
          .join('')
      // Continuation lines align with the item's content. For a task item
      // that's after "- ", not after "- [ ] " (four more spaces = code block).
      const continuation = item.type === 'taskItem' ? '  ' : ' '.repeat(marker.length)
      // "- " with nothing after isn't a list item to marked; a bare "-" is.
      return indent(body, continuation, /^(?:\n|$)/.test(body) ? marker.trimEnd() : marker)
    })
    .join('\n')
}

type Grid = { cells: (ContentNode | null)[][]; width: number }

/** Cells on their grid positions (prosemirror-tables' TableMap); null = covered. */
function tableGrid(table: ContentNode): Grid {
  const rows = table.content ?? []
  const cells: (ContentNode | null | undefined)[][] = rows.map(() => [])
  rows.forEach((row, r) => {
    let c = 0
    for (const cell of row.content ?? []) {
      while (cells[r]?.[c] !== undefined) c++
      const colspan = positiveInt(getAttr(cell, 'colspan')) ?? 1
      const rowspan = positiveInt(getAttr(cell, 'rowspan')) ?? 1
      for (let dr = 0; dr < rowspan && r + dr < rows.length; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          const line = cells[r + dr]
          if (line) line[c + dc] = dr === 0 && dc === 0 ? cell : null
        }
      }
      c += colspan
    }
  })
  const width = Math.max(1, ...cells.map((line) => line.length))
  return {
    cells: cells.map((line) => Array.from({ length: width }, (_, c) => line[c] ?? null)),
    width,
  }
}

const TEXTBLOCKS = new Set(['paragraph', 'heading'])

// A cell is one line of inline Markdown: its text blocks (however nested)
// become lines joined by <br>; code keeps its text; other blocks are dropped.
function cellLines(nodes: ContentNode[], ctx: Context): string[] {
  return nodes.flatMap((node) => {
    if (TEXTBLOCKS.has(node.type ?? '')) return [inline(node, ctx, 'cell')]
    if (node.type === 'codeBlock') {
      const text = (node.content ?? []).map((child) => child.text ?? '').join('')
      const lines = text.split('\n').map((line) => (line ? inlineCode(line, 'cell') : ''))
      return text ? [lines.join('<br>')] : []
    }
    if (node.type === 'blockMath') {
      const tex = inlineTex(String(getAttr(node, 'latex') ?? ''))
      if (ODD_PIPE.test(tex)) lose(ctx, 'tableMathPipe')
      return tex ? [mathMarkdown(tex)] : []
    }
    return node.content ? cellLines(node.content, ctx) : []
  })
}

function cellText(cell: ContentNode, ctx: Context): string {
  const content = cell.content ?? []
  const [only] = content
  let line: string
  if (content.length === 1 && only?.type === 'paragraph') {
    line = inline(only, ctx, 'cell')
  } else {
    lose(ctx, 'tableCellBlocks')
    // One line of Markdown, so one inline context.
    const cellCtx: Context = { ...ctx, tagsOnly: exposesDelimiters(content) }
    line = cellLines(content, cellCtx).filter(Boolean).join('<br>')
  }
  return line.replace(BARE_PIPE, '$1\\|')
}

function renderTable(node: ContentNode, ctx: Context): string {
  const { cells, width } = tableGrid(node)
  if (cells.length === 0) return ''
  let widths = false
  cells.forEach((line, r) => {
    for (const cell of line) {
      if (!cell) continue
      if (getAttr(cell, 'colwidth') != null) widths = true
      const colspan = positiveInt(getAttr(cell, 'colspan')) ?? 1
      const rowspan = positiveInt(getAttr(cell, 'rowspan')) ?? 1
      if (colspan > 1 || rowspan > 1) lose(ctx, 'tableCellSpan')
      if ((cell.type === 'tableHeader') !== (r === 0)) lose(ctx, 'tableHeaders')
    }
  })
  if (widths) lose(ctx, 'tableColumnWidth')
  const rows = cells.map((line) => line.map((cell) => (cell ? cellText(cell, ctx) : '')))
  const row = (line: string[]) => `| ${line.join(' | ')} |`
  const [head = [], ...body] = rows
  return [row(head), `| ${Array(width).fill('---').join(' | ')} |`, ...body.map(row)].join('\n')
}

function block(node: ContentNode, ctx: Context, alternate: boolean): string {
  switch (node.type) {
    case 'paragraph':
      return paragraph(node, ctx)
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(getAttr(node, 'level') ?? 1) || 1))
      // A trailing run of # (after a space) would be read as a closing sequence.
      const text = escapeLineStart(inline(node, ctx, 'heading')).replace(/(^|\s)(#+)$/u, '$1\\$2')
      return `${'#'.repeat(level)} ${text}${pandocLabel(node, ctx, 'sec')}`
    }
    case 'figure': {
      // Only the Pandoc flavour gets here; GFM lowers figures (lowerForMarkdown).
      const [body, caption] = node.content ?? []
      const captionText = caption ? inline(caption, ctx) : ''
      if (body?.type === 'table') {
        return `${renderTable(body, ctx)}\n\n: ${captionText}${pandocLabel(node, ctx, 'tbl')}`
      }
      if (body?.type !== 'image') return ''
      const src = sanitizeUrl(getAttr(body, 'src'), { allowData: true })
      if (!src) return ''
      const alt = getAttr(body, 'alt')
      const attrs = [
        pandocId(node, ctx, 'fig'),
        typeof alt === 'string' && alt ? `fig-alt="${alt.replace(/["\\]/g, '\\$&')}"` : '',
      ].filter(Boolean)
      return `![${captionText}](${linkDestination(src)})${attrs.length > 0 ? `{${attrs.join(' ')}}` : ''}`
    }
    case 'bibliography':
      return '::: {#refs}\n:::'
    case 'blockquote':
      return indent(join(renderedBlocks(node.content ?? [], ctx, { quoted: true })), '> ')
    case 'callout': {
      const emoji = String(getAttr(node, 'emoji') ?? '💡')
      const inner = renderedBlocks(node.content ?? [], ctx)
      // The emoji leads the first paragraph; before anything else it gets its own line.
      const body = join(inner)
      if (inner.length === 0) return `> ${emoji}`
      return indent(
        inner[0]?.node.type === 'paragraph' ? `${emoji} ${body}` : `${emoji}\n\n${body}`,
        '> '
      )
    }
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return renderList(node, ctx, alternate)
    case 'codeBlock': {
      const text = (node.content ?? []).map((child) => child.text ?? '').join('')
      const language = getAttr<string>(node, 'language') ?? ''
      // marked turns tabs into spaces inside list items, even in code, and
      // reads U+2028/U+2029 as line breaks; HTML with entities keeps them.
      if ((ctx.inList && text.includes('\t')) || /[\u2028\u2029]/.test(text)) {
        const lang = language ? ` class="language-${escapeHtml(language)}"` : ''
        return `<pre><code${lang}>${escapeHtml(text).replace(RAW_UNSAFE, entity)}</code></pre>`
      }
      const longest = Math.max(2, ...(text.match(/`{3,}/g) ?? []).map((run) => run.length))
      const fence = '`'.repeat(longest + 1)
      return `${fence}${language}\n${text}\n${fence}`
    }
    case 'horizontalRule':
      return '---'
    case 'image':
      return image(node, ctx)
    case 'youtube':
    case 'iframe': {
      const src = sanitizeUrl(getAttr(node, 'src'))
      if (!src) return ''
      if (positiveInt(getAttr(node, 'start'))) lose(ctx, 'videoStartTime')
      const width = getAttr(node, 'width') ?? 640
      const height = getAttr(node, 'height') ?? 480
      if (width !== 640 || height !== 480) lose(ctx, 'videoSize')
      return youtubeVideoId(src) ? `[Video](${linkDestination(src)})` : ''
    }
    case 'blockMath':
      return `$$\n${String(getAttr(node, 'latex') ?? '')}\n$$${
        getAttr(node, 'numbered') === true ? pandocLabel(node, ctx, 'eq') : ''
      }`
    case 'table':
      return renderTable(node, ctx)
    case 'footnotes':
      return ''
    default:
      return node.content ? join(renderedBlocks(node.content, ctx)) : ''
  }
}

type Rendered = { node: ContentNode; text: string; alternate: boolean }

const join = (blocks: Rendered[]) => blocks.map((rendered) => rendered.text).join('\n\n')

/**
 * Sibling blocks in one container, minus empty paragraphs (Markdown has none).
 * A container left with nothing reads back as one empty paragraph (`refill`),
 * so that one isn't lost. In a blockquote, a leading emoji is written as
 * entities, or the quote would read back as a callout.
 */
function renderedBlocks(
  nodes: ContentNode[],
  ctx: Context,
  { quoted = false, refill = true } = {}
): Rendered[] {
  const out: Rendered[] = []
  let empty = 0
  for (const node of nodes) {
    const previous = out[out.length - 1]
    // Two lists of one kind in a row merge unless the second changes marker.
    const family = listFamily(node)
    const alternate =
      family !== null && previous !== undefined && listFamily(previous.node) === family
        ? !previous.alternate
        : false
    let text = block(node, ctx, alternate)
    if (!text) {
      if (node.type === 'paragraph') empty++
      continue
    }
    if (quoted && out.length === 0 && node.type === 'paragraph') {
      text = text.replace(LEADING_EMOJI, (emoji) => [...emoji].map(entity).join(''))
    }
    out.push({ node, text, alternate })
  }
  lose(ctx, 'emptyParagraph', refill && out.length === 0 ? empty - 1 : empty)
  return out
}

function footnoteDefinitions(doc: ContentNode, ctx: Context): string {
  const list = doc.content?.find((node) => node.type === 'footnotes')
  if (!list?.content) return ''
  return list.content
    .map((note) => {
      const number = ctx.footnotes.get(getAttr<string>(note, 'id') ?? '')
      if (!number) return ''
      return indent(join(renderedBlocks(note.content ?? [], ctx)), '    ', `[^${number}]: `)
    })
    .filter(Boolean)
    .join('\n\n')
}

function render(
  input: ContentDoc | null | undefined,
  options: MarkdownOptions = {}
): { markdown: string; losses: MarkdownLoss[] } {
  if (!input) return { markdown: '', losses: [] }
  const pandoc = options.flavor === 'pandoc'
  const ctx: Context = {
    footnotes: footnoteOrder(input),
    loss: new Map(),
    inList: false,
    pandoc,
    targets: numberDocument(input),
    referenced: referencedIds(input),
    citationKey: options.citationKey ?? ((id) => id),
  }
  const doc = lowerForMarkdown(input, ctx)
  const body = join(renderedBlocks(doc.content ?? [], ctx))
  const notes = footnoteDefinitions(doc, ctx)
  const losses = (Object.keys(LOSSES) as MarkdownLossFeature[])
    .filter((feature) => ctx.loss.has(feature))
    .map((feature) => ({
      feature,
      count: ctx.loss.get(feature) ?? 0,
      description: LOSSES[feature],
    }))
  return { markdown: `${[body, notes].filter(Boolean).join('\n\n')}\n`, losses }
}

export function renderToMarkdown(
  doc: ContentDoc | null | undefined,
  options: MarkdownOptions = {}
): string {
  const { markdown, losses } = render(doc, options)
  options.onLoss?.(losses)
  return markdown
}

/**
 * What renderToMarkdown(doc) can't carry, with counts — for an export warning
 * ("Markdown will drop: text colour (3), column widths (1)"). Everything not
 * listed comes back exactly through markdownToContent.
 */
export function markdownLoss(
  doc: ContentDoc | null | undefined,
  options: Pick<MarkdownOptions, 'flavor'> = {}
): MarkdownLoss[] {
  return render(doc, options).losses
}

// ---------------------------------------------------------------------------
// Research and notes nodes

/**
 * What GFM can't carry, replaced by what a reader would see (counted as
 * losses): a figure's caption becomes a paragraph after it, a cross-reference
 * its label text, a link to another document its title. Citations and the
 * bibliography need the Pandoc flavour; in GFM they're dropped. In the Pandoc
 * flavour only document links are lowered.
 */
function lowerForMarkdown(doc: ContentNode, ctx: Context): ContentNode {
  const walk = (node: ContentNode): ContentNode[] => {
    switch (node.type) {
      case 'documentLink':
        lose(ctx, 'documentLink')
        return [{ type: 'text', text: String(getAttr(node, 'title') ?? '') || 'Untitled' }]
      case 'figure': {
        if (ctx.pandoc) break
        lose(ctx, 'figure')
        const [body, caption] = node.content ?? []
        const out = body ? walk(body) : []
        const captionContent = caption?.content?.flatMap(walk) ?? []
        if (captionContent.length > 0) out.push({ type: 'paragraph', content: captionContent })
        return out
      }
      case 'blockMath':
        if (ctx.pandoc || getAttr(node, 'numbered') !== true) return [node]
        lose(ctx, 'equationNumber')
        return [{ ...node, attrs: { ...node.attrs, numbered: false, tag: null } }]
      case 'citation':
        if (ctx.pandoc) return [node]
        lose(ctx, 'citation')
        return []
      case 'bibliography':
        if (ctx.pandoc) return [node]
        lose(ctx, 'bibliography')
        return []
      case 'crossReference': {
        if (ctx.pandoc) return [node]
        lose(ctx, 'crossReference')
        const target = ctx.targets.get(String(getAttr(node, 'target') ?? ''))
        return [{ type: 'text', text: target?.label ?? '(missing reference)' }]
      }
    }
    return [node.content ? { ...node, content: node.content.flatMap(walk) } : node]
  }
  return walk(doc)[0] ?? doc
}

function referencedIds(doc: ContentNode): Set<string> {
  const ids = new Set<string>()
  const walk = (node: ContentNode) => {
    const target = node.type === 'crossReference' ? getAttr(node, 'target') : null
    if (typeof target === 'string') ids.add(target)
    node.content?.forEach(walk)
  }
  walk(doc)
  return ids
}

const PANDOC_PREFIX: Record<string, string> = {
  figure: 'fig',
  table: 'tbl',
  equation: 'eq',
  heading: 'sec',
}

/** `#fig-<id>` for a node something can cross-reference (Pandoc flavour only). */
function pandocId(node: ContentNode, ctx: Context, prefix: string): string {
  if (!ctx.pandoc) return ''
  const id = getAttr(node, 'id')
  if (typeof id !== 'string' || !ctx.targets.has(id)) return ''
  // Headings get a label only when referenced, to keep the output plain.
  if (prefix === 'sec' && !ctx.referenced.has(id)) return ''
  return `#${prefix}-${id}`
}

/** ` {#fig-<id>}` after a block, or nothing. */
function pandocLabel(node: ContentNode, ctx: Context, prefix: string): string {
  const id = pandocId(node, ctx, prefix)
  return id ? ` {${id}}` : ''
}

/** `[@key, p. 4; @other]`, `@key [p. 4]` (author in text) or `[-@key]` (suppress author). */
function pandocCitation(node: ContentNode, ctx: Context): string {
  const items = getAttr<
    { id: string; locator?: string; label?: string; prefix?: string; suffix?: string }[]
  >(node, 'items')
  if (!Array.isArray(items) || items.length === 0) return ''
  const mode = getAttr(node, 'mode')
  const locator = (item: (typeof items)[number]) => {
    if (!item.locator) return ''
    const label = item.label && item.label !== 'page' ? `${item.label} ` : 'p. '
    return `${label}${item.locator}`
  }
  if (mode === 'author-in-text') {
    const [first, ...rest] = items
    if (!first) return ''
    const pin = [locator(first), first.suffix].filter(Boolean).join(' ')
    const head = `@${ctx.citationKey(first.id)}${pin ? ` [${pin}]` : ''}`
    return rest.length > 0
      ? `${head} [${rest.map((item) => `@${ctx.citationKey(item.id)}`).join('; ')}]`
      : head
  }
  const parts = items.map((item) => {
    const key = `${mode === 'suppress-author' ? '-' : ''}@${ctx.citationKey(item.id)}`
    const pin = locator(item)
    return [item.prefix, key + (pin ? `, ${pin}` : ''), item.suffix].filter(Boolean).join(' ')
  })
  return `[${parts.join('; ')}]`
}

/** `@fig-<id>` and friends; a footnote can't be referenced in Pandoc, so its label is written. */
function pandocReference(node: ContentNode, ctx: Context): string {
  const id = String(getAttr(node, 'target') ?? '')
  const target = ctx.targets.get(id)
  if (!target) return escapeText('(missing reference)')
  const prefix = PANDOC_PREFIX[target.kind]
  return prefix ? `@${prefix}-${id}` : escapeText(target.label)
}
