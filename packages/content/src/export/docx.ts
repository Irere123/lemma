import { sanitizeUrl } from '../sanitize'
import type { ContentMark, ContentNode } from '../types'
import { approximateWordCount, countBookWords, groupChapters } from './book'
import { type ImageSize, imageExtension, imageSize, loadImages } from './images'
import type { ExportBook, ExportChapter, ExportImage, FetchImage } from './types'
import { escapeXml, isoSeconds, positiveInt, videoUrl, w3cDate, walk } from './xml'
import { createZip } from './zip'

// WordprocessingML written by hand. Word rejects a file whose property
// elements are out of schema order, so every serializer below emits children
// in the order ECMA-376 lists them (the tests check this).

export type DocxFormat = 'manuscript' | 'document'

export type DocxOptions = {
  /**
   * 'manuscript' (default): standard manuscript format for submissions.
   * 'document': a clean modern document, e.g. a research paper.
   */
  format?: DocxFormat
  /** Embeds images. Without it (or when it returns null) images become "[Image: alt]". */
  fetchImage?: FetchImage
  /** Default 'letter'. */
  pageSize?: 'letter' | 'a4'
  /** The manuscript running head's title; default: the title, shortened. */
  shortTitle?: string
  /** docProps timestamps and the zip timestamps. Default: now. */
  modified?: Date
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

const NAMESPACES = [
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
].join(' ')

const RELATIONSHIP = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL = {
  document: `${RELATIONSHIP}/officeDocument`,
  core: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  app: `${RELATIONSHIP}/extended-properties`,
  styles: `${RELATIONSHIP}/styles`,
  settings: `${RELATIONSHIP}/settings`,
  numbering: `${RELATIONSHIP}/numbering`,
  footnotes: `${RELATIONSHIP}/footnotes`,
  header: `${RELATIONSHIP}/header`,
  hyperlink: `${RELATIONSHIP}/hyperlink`,
  image: `${RELATIONSHIP}/image`,
}

const CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml'

// Formats Word, Google Docs and LibreOffice all embed natively.
const DOCX_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif'])

const PAGES = { letter: { width: 12240, height: 15840 }, a4: { width: 11906, height: 16838 } }
const MARGIN = 1440 // 1 inch, in twentieths of a point
const INDENT = 720 // half an inch
const EMU_PER_PX = 9525 // at 96 dpi
const EMU_PER_TWIP = 635
const MAX_IMAGE_WIDTH = 6 * 914400 // 6 inches
const MONO = 'Courier New'

type HeadingSpec = { size: number; before: number; after: number; bold?: boolean; italic?: boolean }

type Theme = {
  manuscript: boolean
  font: string
  headingFont: string
  /** Half-points. */
  size: number
  smallSize: number
  /** Line spacing in 240ths of a line. */
  line: number
  /** Space after body paragraphs. */
  after: number
  /** First-line indent of body paragraphs. */
  indent: number
  link?: string
  muted?: string
  rule: string
  shade?: string
  headings: HeadingSpec[]
}

// Standard manuscript format (Shunn): Times New Roman 12 pt, double-spaced,
// ragged right, half-inch indents, black and white.
const MANUSCRIPT: Theme = {
  manuscript: true,
  font: 'Times New Roman',
  headingFont: 'Times New Roman',
  size: 24,
  smallSize: 20,
  line: 480,
  after: 0,
  indent: INDENT,
  rule: 'auto',
  headings: [1, 2, 3, 4, 5, 6].map((level) => ({
    size: 24,
    before: 240,
    after: 0,
    bold: true,
    italic: level >= 3,
  })),
}

// A modern document: Cambria body (Caladea in LibreOffice), Calibri headings
// (Carlito), 1.15 spacing, space between paragraphs instead of indents.
const DOCUMENT: Theme = {
  manuscript: false,
  font: 'Cambria',
  headingFont: 'Calibri',
  size: 22,
  smallSize: 20,
  line: 276,
  after: 160,
  indent: 0,
  link: '0563C1',
  muted: '595959',
  rule: 'A6A6A6',
  shade: 'F2F2F2',
  headings: [
    { size: 32, before: 360, after: 120, bold: true },
    { size: 26, before: 280, after: 80, bold: true },
    { size: 24, before: 240, after: 60, bold: true },
    { size: 22, before: 200, after: 40, bold: true, italic: true },
    { size: 22, before: 200, after: 40, italic: true },
    { size: 22, before: 200, after: 40, italic: true },
  ],
}

// ---------------------------------------------------------------------------
// Property serializers (schema order)
// ---------------------------------------------------------------------------

type Tab = { type: 'left' | 'center' | 'right'; pos: number }

type PPr = {
  style?: string
  keepNext?: boolean
  keepLines?: boolean
  pageBreakBefore?: boolean
  widowControl?: boolean
  numId?: number
  ilvl?: number
  border?: 'box' | 'bottom'
  shade?: string
  tabs?: Tab[]
  before?: number
  after?: number
  line?: number
  ind?: { left?: number; right?: number; firstLine?: number; hanging?: number }
  contextual?: boolean
  jc?: 'left' | 'center' | 'right'
  outline?: number
  sectPr?: string
}

function pPrInner(p: PPr, rule: string): string {
  let out = ''
  if (p.style) out += `<w:pStyle w:val="${p.style}"/>`
  if (p.keepNext) out += '<w:keepNext/>'
  if (p.keepLines) out += '<w:keepLines/>'
  if (p.pageBreakBefore) out += '<w:pageBreakBefore/>'
  if (p.widowControl) out += '<w:widowControl/>'
  if (p.numId !== undefined) {
    out += `<w:numPr><w:ilvl w:val="${p.ilvl ?? 0}"/><w:numId w:val="${p.numId}"/></w:numPr>`
  }
  if (p.border === 'box') {
    const sides = ['top', 'left', 'bottom', 'right']
      .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="4" w:color="${rule}"/>`)
      .join('')
    out += `<w:pBdr>${sides}</w:pBdr>`
  } else if (p.border === 'bottom') {
    out += `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${rule}"/></w:pBdr>`
  }
  if (p.shade) out += `<w:shd w:val="clear" w:color="auto" w:fill="${p.shade}"/>`
  if (p.tabs?.length) {
    out += `<w:tabs>${p.tabs.map((tab) => `<w:tab w:val="${tab.type}" w:pos="${Math.round(tab.pos)}"/>`).join('')}</w:tabs>`
  }
  if (p.before !== undefined || p.after !== undefined || p.line !== undefined) {
    out += `<w:spacing${p.before !== undefined ? ` w:before="${Math.round(p.before)}"` : ''}${
      p.after !== undefined ? ` w:after="${p.after}"` : ''
    }${p.line !== undefined ? ` w:line="${p.line}" w:lineRule="auto"` : ''}/>`
  }
  if (p.ind) {
    const { left, right, firstLine, hanging } = p.ind
    out += `<w:ind${left !== undefined ? ` w:left="${left}"` : ''}${right ? ` w:right="${right}"` : ''}${
      hanging !== undefined
        ? ` w:hanging="${hanging}"`
        : firstLine !== undefined
          ? ` w:firstLine="${firstLine}"`
          : ''
    }/>`
  }
  if (p.contextual) out += '<w:contextualSpacing/>'
  if (p.jc) out += `<w:jc w:val="${p.jc}"/>`
  if (p.outline !== undefined) out += `<w:outlineLvl w:val="${p.outline}"/>`
  if (p.sectPr) out += p.sectPr
  return out
}

type RPr = {
  style?: string
  font?: string
  b?: boolean
  i?: boolean
  strike?: boolean
  color?: string
  size?: number
  highlight?: string
  u?: boolean
  fill?: string
  vert?: 'superscript' | 'subscript'
}

function rPrInner(r: RPr): string {
  let out = ''
  if (r.style) out += `<w:rStyle w:val="${r.style}"/>`
  if (r.font) {
    const font = escapeXml(r.font)
    out += `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/>`
  }
  if (r.b) out += '<w:b/><w:bCs/>'
  if (r.i) out += '<w:i/><w:iCs/>'
  if (r.strike) out += '<w:strike/>'
  if (r.color) out += `<w:color w:val="${r.color}"/>`
  if (r.size) out += `<w:sz w:val="${r.size}"/><w:szCs w:val="${r.size}"/>`
  if (r.highlight) out += `<w:highlight w:val="${r.highlight}"/>`
  if (r.u) out += '<w:u w:val="single"/>'
  if (r.fill) out += `<w:shd w:val="clear" w:color="auto" w:fill="${r.fill}"/>`
  if (r.vert) out += `<w:vertAlign w:val="${r.vert}"/>`
  return out
}

const rPr = (r: RPr) => {
  const inner = rPrInner(r)
  return inner ? `<w:rPr>${inner}</w:rPr>` : ''
}

/** A run of text; newlines become breaks and tabs become tabs. */
function run(text: string, props = ''): string {
  let inner = ''
  for (const part of text.replace(/\r\n?/g, '\n').split(/(\n|\t)/)) {
    if (part === '\n') inner += '<w:br/>'
    else if (part === '\t') inner += '<w:tab/>'
    else if (part) inner += `<w:t xml:space="preserve">${escapeXml(part)}</w:t>`
  }
  return inner ? `<w:r>${props}${inner}</w:r>` : ''
}

const TAB_RUN = '<w:r><w:tab/></w:r>'

// ---------------------------------------------------------------------------
// Package state
// ---------------------------------------------------------------------------

type Relationship = { id: string; type: string; target: string; external: boolean }

function relations() {
  const list: Relationship[] = []
  const ids = new Map<string, string>()
  const add = (type: string, target: string, external = false): string => {
    const key = `${type} ${target}`
    const found = ids.get(key)
    if (found) return found
    const id = `rId${list.length + 1}`
    list.push({ id, type, target, external })
    ids.set(key, id)
    return id
  }
  return { list, add }
}

type Relations = ReturnType<typeof relations>

function relationshipsXml(list: Relationship[]): string {
  return `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list
    .map(
      (rel) =>
        `<Relationship Id="${rel.id}" Type="${rel.type}" Target="${escapeXml(rel.target)}"${
          rel.external ? ' TargetMode="External"' : ''
        }/>`
    )
    .join('')}</Relationships>`
}

type Numbering = {
  abstracts: string[]
  nums: string[]
  bullet?: number
  tasks: Map<boolean, number>
}

const BULLETS = ['•', '◦', '▪']
const ORDER_CYCLE = ['decimal', 'lowerLetter', 'lowerRoman']
const LIST_TYPES: Record<string, string> = {
  '1': 'decimal',
  a: 'lowerLetter',
  A: 'upperLetter',
  i: 'lowerRoman',
  I: 'upperRoman',
}

function numberingLevel(ilvl: number, format: string, text: string, start = 1, font?: string) {
  const fonts = font
    ? `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/></w:rPr>`
    : ''
  return `<w:lvl w:ilvl="${ilvl}"><w:start w:val="${start}"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${escapeXml(
    text
  )}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${INDENT * (ilvl + 1)}" w:hanging="360"/></w:pPr>${fonts}</w:lvl>`
}

function addNumbering(numbering: Numbering, levels: (ilvl: number) => string): number {
  const abstractId = numbering.abstracts.length
  // Word identifies a list by its nsid; two lists sharing one would merge.
  const nsid = (0x4c450000 + abstractId).toString(16).toUpperCase().padStart(8, '0')
  numbering.abstracts.push(
    `<w:abstractNum w:abstractNumId="${abstractId}"><w:nsid w:val="${nsid}"/><w:multiLevelType w:val="hybridMultilevel"/>${Array.from(
      { length: 9 },
      (_, ilvl) => levels(ilvl)
    ).join('')}</w:abstractNum>`
  )
  const numId = numbering.nums.length + 1
  numbering.nums.push(`<w:num w:numId="${numId}"><w:abstractNumId w:val="${abstractId}"/></w:num>`)
  return numId
}

function bulletNumbering(numbering: Numbering): number {
  numbering.bullet ??= addNumbering(numbering, (ilvl) =>
    numberingLevel(ilvl, 'bullet', BULLETS[ilvl % BULLETS.length] ?? '•')
  )
  return numbering.bullet
}

function taskNumbering(numbering: Numbering, checked: boolean): number {
  let numId = numbering.tasks.get(checked)
  if (numId === undefined) {
    // MS Gothic carries the ballot boxes on Windows and macOS (Word's own checkboxes use it).
    numId = addNumbering(numbering, (ilvl) =>
      numberingLevel(ilvl, 'bullet', checked ? '☒' : '☐', 1, 'MS Gothic')
    )
    numbering.tasks.set(checked, numId)
  }
  return numId
}

// Each ordered list gets its own definition: the one way to restart numbering
// that every word processor honours (Word continues lists that share one).
function orderedNumbering(numbering: Numbering, depth: number, start: number, type: string) {
  return addNumbering(numbering, (ilvl) =>
    numberingLevel(
      ilvl,
      ilvl === depth ? (LIST_TYPES[type] ?? 'decimal') : (ORDER_CYCLE[ilvl % 3] ?? 'decimal'),
      `%${ilvl + 1}.`,
      ilvl === depth ? start : 1
    )
  )
}

type Media = { name: string; image: ExportImage; size: ImageSize | null }
type PartName = 'document' | 'footnotes'

type Ctx = {
  theme: Theme
  page: { width: number; height: number }
  textWidth: number
  media: Map<string, Media>
  usedMedia: Set<Media>
  rels: Record<PartName, Relations>
  numbering: Numbering
  footnotes: string[]
  nextFootnote: number
  /** This chapter's note bodies, and the footnote id each one got. */
  notes: Map<string, ContentNode>
  noteIds: Map<string, number>
  /** Markup that opens the next paragraph: bookmarks, a footnote mark, a callout's emoji. */
  pending: string[]
  /** Bookmark names that some link points at (and that exist). */
  anchors: Set<string>
  anchored: Set<string>
  nextBookmark: number
  nextDrawing: number
  /** The next body paragraph opens a section (no first-line indent). */
  afterBreak: boolean
  /** Added to a document heading's level to get its Heading style. */
  headingShift: number
}

type Scope = {
  part: PartName
  /** Running body text of a chapter (not inside a list, quote, table or note). */
  top: boolean
  style?: string
  indent: number
  right: number
  depth: number
  box: boolean
  bold: boolean
  keep: boolean
  inNote: boolean
}

const BODY_SCOPE: Scope = {
  part: 'document',
  top: true,
  indent: 0,
  right: 0,
  depth: 0,
  box: false,
  bold: false,
  keep: false,
  inNote: false,
}

function paragraph(ctx: Ctx, p: PPr, content: string): string {
  const opening = ctx.pending.join('')
  ctx.pending = []
  const props = pPrInner(p, ctx.theme.rule)
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}${opening}${content}</w:p>`
}

function containerProps(scope: Scope, ctx: Ctx): PPr {
  const p: PPr = {}
  if (scope.style) p.style = scope.style
  if (scope.indent || scope.right) p.ind = { left: scope.indent, right: scope.right, firstLine: 0 }
  if (scope.box) {
    p.border = 'box'
    p.shade = ctx.theme.shade
  }
  if (scope.keep) p.keepNext = true
  return p
}

/** Bookmark names: letters, digits and underscores, at most 40, starting with a letter. */
function bookmarkName(id: string): string {
  const name = id.replace(/[^A-Za-z0-9_]/g, '_')
  return (/^[A-Za-z]/.test(name) ? name : `b${name}`).slice(0, 40)
}

function queueBookmark(node: ContentNode, ctx: Ctx): void {
  const id = node.attrs?.id
  if (typeof id !== 'string' || !id) return
  const name = bookmarkName(id)
  if (!ctx.anchors.has(name) || ctx.anchored.has(name)) return
  ctx.anchored.add(name)
  const n = ctx.nextBookmark++
  ctx.pending.push(`<w:bookmarkStart w:id="${n}" w:name="${name}"/><w:bookmarkEnd w:id="${n}"/>`)
}

function hexColor(value: unknown): string | undefined {
  const hex =
    typeof value === 'string' ? /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())?.[1] : null
  if (!hex) return undefined
  return (hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex).toUpperCase()
}

function rawText(node: ContentNode): string {
  if (typeof node.text === 'string') return node.text
  return (node.content ?? []).map(rawText).join('')
}

// ---------------------------------------------------------------------------
// Inline content
// ---------------------------------------------------------------------------

function markProps(
  marks: ContentMark[] | null | undefined,
  ctx: Ctx,
  base: RPr,
  linked: boolean
): RPr {
  const props: RPr = { ...base }
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case 'bold':
      case 'strong':
        props.b = true
        break
      case 'italic':
      case 'em':
        props.i = true
        break
      case 'underline':
        props.u = true
        break
      case 'strike':
      case 'strikethrough':
        props.strike = true
        break
      case 'code':
        props.style = 'InlineCode'
        break
      case 'superscript':
        props.vert = 'superscript'
        break
      case 'subscript':
        props.vert = 'subscript'
        break
      case 'highlight': {
        const fill = hexColor(mark.attrs?.color)
        if (fill) props.fill = fill
        else props.highlight = 'yellow'
        break
      }
      case 'textStyle':
        // Manuscripts are black on white.
        if (!ctx.theme.manuscript) props.color = hexColor(mark.attrs?.color) ?? props.color
        break
    }
  }
  if (linked) {
    if (props.style) {
      props.u = true
      props.color = ctx.theme.link ?? props.color
    } else {
      props.style = 'Hyperlink'
    }
  }
  return props
}

/** A link the document can keep: a web/mail link, or a bookmark that exists. */
function linkTarget(node: ContentNode, ctx: Ctx): string | null {
  const mark = (node.marks ?? []).find((candidate) => candidate.type === 'link')
  const href = sanitizeUrl(mark?.attrs?.href)
  if (!href) return null
  if (href.startsWith('#')) return ctx.anchors.has(bookmarkName(href.slice(1))) ? href : null
  // Site-relative links mean nothing in a file.
  return /^(https?:|mailto:|tel:)/i.test(href) ? href : null
}

function hyperlink(href: string, runs: string, ctx: Ctx, scope: Scope): string {
  if (!runs) return ''
  if (href.startsWith('#')) {
    return `<w:hyperlink w:anchor="${bookmarkName(href.slice(1))}" w:history="1">${runs}</w:hyperlink>`
  }
  const target = href.replace(/\s/g, (space) => encodeURIComponent(space))
  const id = ctx.rels[scope.part].add(REL.hyperlink, target, true)
  return `<w:hyperlink r:id="${id}" w:history="1">${runs}</w:hyperlink>`
}

function inlines(
  nodes: ContentNode[] | null | undefined,
  ctx: Ctx,
  scope: Scope,
  base: RPr = {}
): string {
  // Adjacent nodes with the same link share one hyperlink.
  let out = ''
  let href: string | null = null
  let runs = ''
  for (const node of nodes ?? []) {
    const target = linkTarget(node, ctx)
    if (target !== href) {
      out += href === null ? runs : hyperlink(href, runs, ctx, scope)
      href = target
      runs = ''
    }
    runs += inline(node, ctx, scope, base, target !== null)
  }
  return out + (href === null ? runs : hyperlink(href, runs, ctx, scope))
}

function inline(node: ContentNode, ctx: Ctx, scope: Scope, base: RPr, linked: boolean): string {
  switch (node.type) {
    case 'text':
      return run(node.text ?? '', rPr(markProps(node.marks, ctx, base, linked)))
    case 'hardBreak':
      return '<w:r><w:br/></w:r>'
    case 'footnoteReference':
      return footnoteReference(node, ctx, scope)
    case 'inlineMath':
    case 'math':
      return run(
        String(node.attrs?.latex ?? ''),
        rPr({ ...markProps(node.marks, ctx, base, false), style: 'Math' })
      )
    case 'image':
      return imageRun(node, ctx, scope) ?? run(imagePlaceholder(node), rPr({ ...base, i: true }))
    default:
      if (node.content) return inlines(node.content, ctx, scope, base)
      return typeof node.text === 'string'
        ? run(node.text, rPr(markProps(node.marks, ctx, base, linked)))
        : ''
  }
}

const FOOTNOTE_MARK = '<w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr>'

function footnoteReference(node: ContentNode, ctx: Ctx, scope: Scope): string {
  // Word has no notes inside notes.
  if (scope.inNote) return ''
  const id = typeof node.attrs?.id === 'string' ? node.attrs.id : ''
  if (!id) return ''
  // Word allows one reference per footnote; a repeat shows the same number as
  // plain superscript. Notes are numbered by first reference, from 1, so the
  // footnote id is the number Word displays.
  const existing = ctx.noteIds.get(id)
  if (existing !== undefined) return `<w:r>${FOOTNOTE_MARK}<w:t>${existing}</w:t></w:r>`

  const number = ctx.nextFootnote++
  ctx.noteIds.set(id, number)
  const saved = ctx.pending
  ctx.pending = [
    `<w:r>${FOOTNOTE_MARK}<w:footnoteRef/></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r>`,
  ]
  const noteScope: Scope = {
    ...BODY_SCOPE,
    part: 'footnotes',
    top: false,
    style: 'FootnoteText',
    inNote: true,
  }
  let body = blocks(ctx.notes.get(id)?.content, ctx, noteScope)
  if (ctx.pending.length > 0) body = paragraph(ctx, { style: 'FootnoteText' }, '') + body
  if (!body.endsWith('</w:p>')) body += '<w:p/>'
  ctx.pending = saved
  ctx.footnotes.push(`<w:footnote w:id="${number}">${body}</w:footnote>`)
  return `<w:r>${FOOTNOTE_MARK}<w:footnoteReference w:id="${number}"/></w:r>`
}

function imagePlaceholder(node: ContentNode): string {
  const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt.trim() : ''
  return alt ? `[Image: ${alt}]` : '[Image]'
}

/** Display size in EMU: the editor's width (or the file's own), at most `maxWidth`, aspect kept. */
function imageExtent(
  node: ContentNode,
  natural: ImageSize | null,
  maxWidth: number,
  maxHeight: number
): { cx: number; cy: number } {
  const width = positiveInt(node.attrs?.width)
  const height = positiveInt(node.attrs?.height)
  let w: number
  let h: number
  if (width && height) {
    w = width
    h = height
  } else if (width) {
    w = width
    h = natural ? (width * natural.height) / natural.width : width * 0.75
  } else if (height && natural) {
    h = height
    w = (height * natural.width) / natural.height
  } else if (natural) {
    w = natural.width
    h = natural.height
  } else {
    // Unknown size: full width at 4:3.
    w = maxWidth / EMU_PER_PX
    h = w * 0.75
  }
  const scale = Math.min(1, maxWidth / (w * EMU_PER_PX), maxHeight / (h * EMU_PER_PX))
  return {
    cx: Math.max(1, Math.round(w * EMU_PER_PX * scale)),
    cy: Math.max(1, Math.round(h * EMU_PER_PX * scale)),
  }
}

function imageRun(node: ContentNode, ctx: Ctx, scope: Scope): string | null {
  const src = sanitizeUrl(node.attrs?.src, { allowData: true })
  const media = src ? ctx.media.get(src) : undefined
  if (!media) return null
  ctx.usedMedia.add(media)
  const available = (ctx.textWidth - scope.indent - scope.right) * EMU_PER_TWIP
  const maxHeight = (ctx.page.height - 2 * MARGIN - 1440) * EMU_PER_TWIP
  const { cx, cy } = imageExtent(node, media.size, Math.min(MAX_IMAGE_WIDTH, available), maxHeight)
  const rId = ctx.rels[scope.part].add(REL.image, `media/${media.name}`)
  const id = ctx.nextDrawing++
  const alt = escapeXml(typeof node.attrs?.alt === 'string' ? node.attrs.alt : '')
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${id}" name="Picture ${id}" descr="${alt}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${media.name}" descr="${alt}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const INLINE_TYPES = new Set(['text', 'hardBreak', 'footnoteReference', 'inlineMath', 'math'])

function blocks(nodes: ContentNode[] | null | undefined, ctx: Ctx, scope: Scope): string {
  let out = ''
  for (const node of nodes ?? []) {
    const xml = block(node, ctx, scope)
    // Word merges adjacent tables; an empty paragraph keeps them apart.
    if (out.endsWith('</w:tbl>') && xml.startsWith('<w:tbl>')) out += '<w:p/>'
    out += xml
  }
  return out
}

function block(node: ContentNode, ctx: Ctx, scope: Scope): string {
  queueBookmark(node, ctx)
  const flow = (afterBreak: boolean) => {
    if (scope.top) ctx.afterBreak = afterBreak
  }
  switch (node.type) {
    case 'paragraph': {
      const props = containerProps(scope, ctx)
      if (scope.top) {
        props.style = ctx.afterBreak ? 'FirstParagraph' : 'BodyText'
        ctx.afterBreak = false
      }
      return paragraph(ctx, props, inlines(node.content, ctx, scope, scope.bold ? { b: true } : {}))
    }

    case 'heading': {
      const level = Math.round(Number(node.attrs?.level) || 1)
      flow(true)
      const style = `Heading${Math.min(6, Math.max(1, level + ctx.headingShift))}`
      return paragraph(
        ctx,
        { ...containerProps(scope, ctx), style },
        inlines(node.content, ctx, scope)
      )
    }

    case 'blockquote':
      flow(false)
      return blocks(node.content, ctx, {
        ...scope,
        top: false,
        style: scope.style ?? 'BlockText',
        indent: scope.indent + INDENT,
        right: scope.right + INDENT,
      })

    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      flow(false)
      return list(node, ctx, { ...scope, top: false })

    case 'codeBlock': {
      flow(false)
      const code = rawText(node).replace(/\r\n?/g, '\n').replace(/\n$/, '')
      return paragraph(ctx, { ...containerProps(scope, ctx), style: 'SourceCode' }, run(code))
    }

    case 'horizontalRule':
      flow(true)
      // A manuscript marks a scene break with a centred "#".
      return ctx.theme.manuscript
        ? paragraph(ctx, { ...containerProps(scope, ctx), style: 'SceneBreak' }, run('#'))
        : paragraph(ctx, { ...containerProps(scope, ctx), style: 'HorizontalRule' }, '')

    case 'image':
      flow(false)
      return paragraph(
        ctx,
        { ...containerProps(scope, ctx), style: 'Figure' },
        imageRun(node, ctx, scope) ?? run(imagePlaceholder(node), rPr({ i: true }))
      )

    case 'youtube':
    case 'iframe': {
      flow(false)
      const url = videoUrl(node)
      if (!url) return ''
      const label = run(url.replace(/^https?:\/\/(www\.)?/, ''), rPr({ style: 'Hyperlink' }))
      return paragraph(
        ctx,
        { ...containerProps(scope, ctx), style: 'Figure' },
        run('Video: ') + hyperlink(url, label, ctx, scope)
      )
    }

    case 'blockMath':
      flow(false)
      return equation(node, ctx, scope)

    case 'callout': {
      flow(false)
      const emoji = String(node.attrs?.emoji ?? '💡').trim()
      if (emoji) ctx.pending.push(run(`${emoji} `, rPr({ font: 'Segoe UI Emoji' })))
      return blocks(node.content, ctx, {
        ...scope,
        top: false,
        style: scope.style ?? 'Callout',
        box: true,
      })
    }

    case 'table':
      flow(false)
      return table(node, ctx, scope)

    case 'figure':
      flow(false)
      return figure(node, ctx, scope)

    case 'figcaption':
      return caption('', node.content, ctx, scope)

    case 'footnotes':
      return '' // placed in footnotes.xml at each reference

    case 'text':
      return paragraph(ctx, containerProps(scope, ctx), inline(node, ctx, scope, {}, false))

    default: {
      // Unknown or wrapper nodes: keep their text.
      const children = node.content ?? []
      if (children.some((child) => INLINE_TYPES.has(child.type ?? ''))) {
        return paragraph(ctx, containerProps(scope, ctx), inlines(children, ctx, scope))
      }
      return blocks(children, ctx, scope)
    }
  }
}

function list(node: ContentNode, ctx: Ctx, scope: Scope): string {
  const ilvl = Math.min(scope.depth, 8)
  const start = Math.round(Number(node.attrs?.start ?? 1))
  const numId =
    node.type === 'orderedList'
      ? orderedNumbering(
          ctx.numbering,
          ilvl,
          Number.isFinite(start) && start >= 0 ? start : 1,
          String(node.attrs?.type ?? '1')
        )
      : bulletNumbering(ctx.numbering)
  const inner: Scope = {
    ...scope,
    indent: scope.indent + INDENT,
    depth: scope.depth + 1,
    style: scope.style ?? 'ListParagraph',
  }
  let out = ''
  for (const item of node.content ?? []) {
    queueBookmark(item, ctx)
    const numbered: PPr = {
      ...containerProps(inner, ctx),
      numId:
        node.type === 'taskList'
          ? taskNumbering(ctx.numbering, item.attrs?.checked === true)
          : numId,
      ilvl,
      ind: { left: inner.indent, right: inner.right, hanging: 360 },
    }
    const [first, ...rest] = item.content ?? []
    if (first?.type === 'paragraph') {
      queueBookmark(first, ctx)
      out += paragraph(
        ctx,
        numbered,
        inlines(first.content, ctx, inner, inner.bold ? { b: true } : {})
      )
      out += blocks(rest, ctx, inner)
    } else {
      out += paragraph(ctx, numbered, '')
      out += blocks(item.content, ctx, inner)
    }
  }
  return out
}

/** Display math: the TeX centred on a tab, its label (e.g. "(4)") right-aligned. */
function equation(node: ContentNode, ctx: Ctx, scope: Scope): string {
  const left = scope.indent
  const right = ctx.textWidth - scope.right
  const label = typeof node.attrs?.label === 'string' ? node.attrs.label.trim() : ''
  const math = run(String(node.attrs?.latex ?? ''), rPr({ style: 'Math' }))
  return paragraph(
    ctx,
    {
      ...containerProps(scope, ctx),
      style: 'Equation',
      tabs: [
        { type: 'center', pos: (left + right) / 2 },
        { type: 'right', pos: right },
      ],
    },
    `${TAB_RUN}${math}${label ? `${TAB_RUN}${run(label)}` : ''}`
  )
}

function caption(
  label: string,
  content: ContentNode[] | null | undefined,
  ctx: Ctx,
  scope: Scope
): string {
  const body = inlines(content, ctx, scope)
  const hasText = (content ?? []).length > 0
  const text = label && hasText && !/[.:;!?]$/.test(label) ? `${label}.` : label
  const labelRun = text ? run(hasText ? `${text} ` : text, rPr({ b: true })) : ''
  return paragraph(ctx, { ...containerProps(scope, ctx), style: 'Caption' }, labelRun + body)
}

function figure(node: ContentNode, ctx: Ctx, scope: Scope): string {
  const label = typeof node.attrs?.label === 'string' ? node.attrs.label.trim() : ''
  const children = node.content ?? []
  const captioned = children.some((child) => child.type === 'figcaption')
  let out = ''
  children.forEach((child, index) => {
    if (child.type === 'figcaption') {
      out += caption(label, child.content, ctx, scope)
      return
    }
    // An image stays on the page with a caption that follows it.
    const next = children[index + 1]
    const keep = next?.type === 'figcaption' && child.type !== 'table'
    out += block(child, ctx, { ...scope, top: false, keep })
  })
  if (!captioned && label) out += caption(label, [], ctx, scope)
  return out
}

type GridCell = {
  node: ContentNode | null
  col: number
  span: number
  merge?: 'restart' | 'continue'
  header: boolean
}

function table(node: ContentNode, ctx: Ctx, scope: Scope): string {
  const rows = (node.content ?? []).filter((row) => row.type === 'tableRow')
  if (rows.length === 0) return ''

  // Lay the cells on a grid. A rowspan becomes vMerge: a "restart" cell, then
  // a "continue" cell in each row it covers.
  const spanning = new Map<number, { left: number; span: number }>()
  const grid: GridCell[][] = []
  let columns = 0
  for (const row of rows) {
    const cells: GridCell[] = []
    let col = 0
    const continueMerges = () => {
      for (let merge = spanning.get(col); merge; merge = spanning.get(col)) {
        cells.push({ node: null, col, span: merge.span, merge: 'continue', header: false })
        merge.left -= 1
        if (merge.left === 0) spanning.delete(col)
        col += merge.span
      }
    }
    for (const cell of row.content ?? []) {
      continueMerges()
      const span = positiveInt(cell.attrs?.colspan) ?? 1
      const rowspan = positiveInt(cell.attrs?.rowspan) ?? 1
      const entry: GridCell = { node: cell, col, span, header: cell.type === 'tableHeader' }
      if (rowspan > 1) {
        entry.merge = 'restart'
        spanning.set(col, { left: rowspan - 1, span })
      }
      cells.push(entry)
      col += span
    }
    // Merges further right than this row's last cell.
    for (const start of [...spanning.keys()].sort((a, b) => a - b)) {
      if (start < col) continue
      while (col < start) cells.push({ node: null, col: col++, span: 1, header: false })
      continueMerges()
    }
    columns = Math.max(columns, col)
    grid.push(cells)
  }
  for (const cells of grid) {
    let col = cells.reduce((end, cell) => Math.max(end, cell.col + cell.span), 0)
    while (col < columns) cells.push({ node: null, col: col++, span: 1, header: false })
  }

  // Column widths: the editor's (px) scaled to fit, or equal shares.
  const available = ctx.textWidth - scope.indent - scope.right
  const pixels: (number | null)[] = []
  for (const cell of rows[0]?.content ?? []) {
    const span = positiveInt(cell.attrs?.colspan) ?? 1
    const widths = Array.isArray(cell.attrs?.colwidth) ? (cell.attrs.colwidth as unknown[]) : []
    for (let i = 0; i < span; i++) pixels.push(positiveInt(widths[i]))
  }
  let widths: number[]
  if (pixels.length === columns && pixels.every((w) => w !== null)) {
    const twips = pixels.map((w) => (w ?? 0) * 15)
    const scale = Math.min(1, available / twips.reduce((sum, w) => sum + w, 0))
    widths = twips.map((w) => Math.max(1, Math.floor(w * scale)))
  } else {
    widths = Array.from({ length: columns }, () => Math.floor(available / columns))
  }
  const total = widths.reduce((sum, w) => sum + w, 0)

  let headerRows = 0
  while (
    headerRows < grid.length &&
    (grid[headerRows] ?? []).some((cell) => cell.node) &&
    (grid[headerRows] ?? []).every((cell) => !cell.node || cell.header)
  ) {
    headerRows += 1
  }

  const border = (side: string) =>
    `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="${ctx.theme.rule}"/>`
  const tblPr = `<w:tblPr><w:tblStyle w:val="Table"/><w:tblW w:w="${total}" w:type="dxa"/>${
    scope.indent ? `<w:tblInd w:w="${scope.indent}" w:type="dxa"/>` : ''
  }<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map(border)
    .join(
      ''
    )}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr>`
  const tblGrid = `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`

  const cellScope: Scope = {
    ...scope,
    top: false,
    style: 'TableText',
    indent: 0,
    right: 0,
    depth: 0,
    box: false,
    keep: false,
  }
  const rowsXml = grid.map((cells, index) => {
    const trPr = index < headerRows ? '<w:trPr><w:tblHeader/></w:trPr>' : ''
    const tcs = cells.map((cell) => {
      const width = widths.slice(cell.col, cell.col + cell.span).reduce((sum, w) => sum + w, 0)
      const merge =
        cell.merge === 'restart'
          ? '<w:vMerge w:val="restart"/>'
          : cell.merge === 'continue'
            ? '<w:vMerge/>'
            : ''
      const shade =
        cell.header && ctx.theme.shade
          ? `<w:shd w:val="clear" w:color="auto" w:fill="${ctx.theme.shade}"/>`
          : ''
      const tcPr = `<w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${
        cell.span > 1 ? `<w:gridSpan w:val="${cell.span}"/>` : ''
      }${merge}${shade}</w:tcPr>`
      let content = cell.node
        ? blocks(cell.node.content, ctx, { ...cellScope, bold: cell.header })
        : ''
      // A cell must end with a paragraph.
      if (!content.endsWith('</w:p>')) content += paragraph(ctx, { style: 'TableText' }, '')
      return `<w:tc>${tcPr}${content}</w:tc>`
    })
    return `<w:tr>${trPr}${tcs.join('')}</w:tr>`
  })
  return `<w:tbl>${tblPr}${tblGrid}${rowsXml.join('')}</w:tbl>`
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

type StyleOptions = {
  isDefault?: boolean
  basedOn?: string
  next?: string
  ui?: number
  semiHidden?: boolean
  q?: boolean
  pPr?: string
  rPr?: string
  tblPr?: string
}

function style(type: string, id: string, name: string, o: StyleOptions): string {
  return `<w:style w:type="${type}"${o.isDefault ? ' w:default="1"' : ''} w:styleId="${id}"><w:name w:val="${name}"/>${
    o.basedOn ? `<w:basedOn w:val="${o.basedOn}"/>` : ''
  }${o.next ? `<w:next w:val="${o.next}"/>` : ''}${o.ui !== undefined ? `<w:uiPriority w:val="${o.ui}"/>` : ''}${
    o.semiHidden ? '<w:semiHidden/><w:unhideWhenUsed/>' : ''
  }${o.q ? '<w:qFormat/>' : ''}${o.pPr ? `<w:pPr>${o.pPr}</w:pPr>` : ''}${
    o.rPr ? `<w:rPr>${o.rPr}</w:rPr>` : ''
  }${o.tblPr ? `<w:tblPr>${o.tblPr}</w:tblPr>` : ''}</w:style>`
}

function stylesXml(theme: Theme, language: string, textWidth: number): string {
  const t = theme
  const ms = t.manuscript
  const P = (p: PPr) => pPrInner(p, t.rule)
  const R = rPrInner
  const heading = (font: string) => (font === t.font ? undefined : font)
  const styles = [
    style('paragraph', 'Normal', 'Normal', {
      isDefault: true,
      q: true,
      pPr: P({ widowControl: true }),
    }),
    style('paragraph', 'BodyText', 'Body Text', {
      basedOn: 'Normal',
      next: 'BodyText',
      q: true,
      pPr: P({ after: t.after, ind: t.indent ? { firstLine: t.indent } : undefined }),
    }),
    style('paragraph', 'FirstParagraph', 'First Paragraph', {
      basedOn: 'BodyText',
      next: 'BodyText',
      q: true,
      pPr: P({ ind: { firstLine: 0 } }),
    }),
    ...t.headings.map((h, index) =>
      style('paragraph', `Heading${index + 1}`, `heading ${index + 1}`, {
        basedOn: 'Normal',
        next: 'FirstParagraph',
        ui: 9,
        q: true,
        pPr: P({
          keepNext: true,
          keepLines: true,
          before: h.before,
          after: h.after,
          outline: index,
        }),
        rPr: R({
          font: heading(t.headingFont),
          b: h.bold,
          i: h.italic,
          color: index === 5 ? t.muted : undefined,
          size: h.size === t.size ? undefined : h.size,
        }),
      })
    ),
    style('paragraph', 'Title', 'Title', {
      basedOn: 'Normal',
      next: 'Subtitle',
      ui: 10,
      q: true,
      pPr: P(ms ? { jc: 'center' } : { after: 80 }),
      rPr: R(ms ? {} : { font: heading(t.headingFont), size: 52 }),
    }),
    style('paragraph', 'Subtitle', 'Subtitle', {
      basedOn: 'Normal',
      next: 'Author',
      ui: 11,
      q: true,
      pPr: P(ms ? { jc: 'center' } : { after: 160 }),
      rPr: R(ms ? {} : { font: heading(t.headingFont), size: 30, color: t.muted }),
    }),
    style('paragraph', 'Author', 'Author', {
      basedOn: 'Normal',
      next: 'BodyText',
      q: true,
      pPr: P(ms ? { jc: 'center' } : { after: 60 }),
      rPr: R(ms ? {} : { size: 24 }),
    }),
    style('paragraph', 'Date', 'Date', {
      basedOn: 'Normal',
      next: 'BodyText',
      pPr: P(ms ? { jc: 'center' } : { after: 360 }),
      rPr: R({ color: t.muted }),
    }),
    style('paragraph', 'TitlePageInfo', 'Contact Info', {
      basedOn: 'Normal',
      pPr: P({ line: 240 }),
    }),
    style('paragraph', 'PartTitle', 'Part Title', {
      basedOn: 'Normal',
      next: 'ChapterTitle',
      q: true,
      pPr: P({ keepNext: true, jc: 'center' }),
    }),
    style('paragraph', 'ChapterTitle', 'Chapter Title', {
      basedOn: 'Normal',
      next: 'FirstParagraph',
      q: true,
      pPr: P({ keepNext: true, keepLines: true, after: 480, jc: 'center' }),
    }),
    style('paragraph', 'SceneBreak', 'Scene Break', {
      basedOn: 'Normal',
      next: 'FirstParagraph',
      q: true,
      pPr: P({ jc: 'center' }),
    }),
    style('paragraph', 'HorizontalRule', 'Horizontal Rule', {
      basedOn: 'Normal',
      next: 'FirstParagraph',
      pPr: P({ border: 'bottom', before: 120, after: 240, line: 240 }),
    }),
    style('paragraph', 'BlockText', 'Block Text', {
      basedOn: 'Normal',
      q: true,
      pPr: P({ after: t.after, ind: { left: INDENT, right: INDENT, firstLine: 0 } }),
      rPr: R({ color: ms ? undefined : '404040' }),
    }),
    style('paragraph', 'ListParagraph', 'List Paragraph', {
      basedOn: 'Normal',
      ui: 34,
      q: true,
      pPr: P({ after: t.after, ind: { left: INDENT, firstLine: 0 }, contextual: !ms }),
    }),
    style('paragraph', 'SourceCode', 'Source Code', {
      basedOn: 'Normal',
      pPr: P({ shade: t.shade, before: ms ? 0 : 60, after: ms ? 0 : 160, line: 240 }),
      rPr: R({ font: MONO, size: 20 }),
    }),
    style('paragraph', 'TableText', 'Table Text', {
      basedOn: 'Normal',
      q: true,
      pPr: P({ after: 0, line: 240, ind: { firstLine: 0 } }),
      rPr: R({ size: ms ? undefined : t.smallSize }),
    }),
    style('paragraph', 'Callout', 'Callout', {
      basedOn: 'Normal',
      q: true,
      pPr: P({ after: t.after, ind: { firstLine: 0 } }),
    }),
    style('paragraph', 'Figure', 'Figure', {
      basedOn: 'Normal',
      next: 'Caption',
      q: true,
      // Single spacing: "double" would also double an inline picture's line.
      pPr: P({ before: 120, after: 120, line: 240, ind: { firstLine: 0 }, jc: 'center' }),
    }),
    style('paragraph', 'Caption', 'caption', {
      basedOn: 'Normal',
      next: 'BodyText',
      ui: 35,
      q: true,
      pPr: P({ after: 240, line: 240, jc: 'center' }),
      rPr: R({ i: true, color: t.muted, size: ms ? undefined : t.smallSize }),
    }),
    style('paragraph', 'Equation', 'Equation', {
      basedOn: 'Normal',
      next: 'BodyText',
      pPr: P({ before: 120, after: 120, ind: { firstLine: 0 } }),
    }),
    style('paragraph', 'FootnoteText', 'footnote text', {
      basedOn: 'Normal',
      ui: 99,
      pPr: P({ after: 0, line: 240 }),
      rPr: R({ size: t.smallSize }),
    }),
    style('paragraph', 'Header', 'header', {
      basedOn: 'Normal',
      ui: 99,
      pPr: P({
        tabs: [
          { type: 'center', pos: textWidth / 2 },
          { type: 'right', pos: textWidth },
        ],
        after: 0,
        line: 240,
      }),
    }),
    style('character', 'DefaultParagraphFont', 'Default Paragraph Font', {
      isDefault: true,
      ui: 1,
      semiHidden: true,
    }),
    style('character', 'FootnoteReference', 'footnote reference', {
      basedOn: 'DefaultParagraphFont',
      ui: 99,
      rPr: R({ vert: 'superscript' }),
    }),
    style('character', 'Hyperlink', 'Hyperlink', {
      basedOn: 'DefaultParagraphFont',
      ui: 99,
      rPr: R({ color: t.link, u: true }),
    }),
    style('character', 'InlineCode', 'Inline Code', {
      basedOn: 'DefaultParagraphFont',
      rPr: R({ font: MONO, size: ms ? undefined : 20 }),
    }),
    style('character', 'Math', 'Math', {
      basedOn: 'DefaultParagraphFont',
      rPr: R({ font: 'Cambria Math', i: true }),
    }),
    style('table', 'TableNormal', 'Normal Table', {
      isDefault: true,
      ui: 99,
      semiHidden: true,
      tblPr:
        '<w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar>',
    }),
    style('table', 'Table', 'Table', {
      basedOn: 'TableNormal',
      ui: 59,
      tblPr: `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
        .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="${t.rule}"/>`)
        .join('')}</w:tblBorders>`,
    }),
    style('numbering', 'NoList', 'No List', { isDefault: true, ui: 99, semiHidden: true }),
  ]
  const defaults = `<w:docDefaults><w:rPrDefault><w:rPr>${R({ font: t.font, size: t.size })}<w:lang w:val="${escapeXml(
    language
  )}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>${P({ after: 0, line: t.line })}</w:pPr></w:pPrDefault></w:docDefaults>`
  return `${XML_HEADER}<w:styles ${NAMESPACES}>${defaults}${styles.join('')}</w:styles>`
}

function settingsXml(language: string): string {
  return `${XML_HEADER}<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="${INDENT}"/><w:characterSpacingControl w:val="doNotCompress"/><w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat><w:themeFontLang w:val="${escapeXml(
    language
  )}"/><w:decimalSymbol w:val="."/><w:listSeparator w:val=","/></w:settings>`
}

function footnotesXml(notes: string[]): string {
  const separator = (type: string, id: number, mark: string) =>
    `<w:footnote w:type="${type}" w:id="${id}"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:${mark}/></w:r></w:p></w:footnote>`
  return `${XML_HEADER}<w:footnotes ${NAMESPACES}>${separator('separator', -1, 'separator')}${separator(
    'continuationSeparator',
    0,
    'continuationSeparator'
  )}${notes.join('')}</w:footnotes>`
}

const PAGE_FIELD =
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>'

function headerXml(text: string): string {
  return `${XML_HEADER}<w:hdr ${NAMESPACES}><w:p><w:pPr><w:pStyle w:val="Header"/><w:jc w:val="right"/></w:pPr>${run(
    text
  )}${PAGE_FIELD}</w:p></w:hdr>`
}

function sectPr(ctx: Ctx, options: { header?: string; start?: number } = {}): string {
  return `<w:sectPr>${options.header ? `<w:headerReference w:type="default" r:id="${options.header}"/>` : ''}<w:pgSz w:w="${
    ctx.page.width
  }" w:h="${ctx.page.height}"/><w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="720" w:footer="720" w:gutter="0"/>${
    options.start ? `<w:pgNumType w:start="${options.start}"/>` : ''
  }<w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>`
}

/** "Le Guin" from "Ursula K. Le Guin" is out of reach; the last word, minus suffixes, is close. */
function surname(author: string): string {
  const words = author.trim().split(/\s+/).filter(Boolean)
  while (words.length > 1 && /^(jr|sr|ii|iii|iv|phd|md)\.?$/i.test(words.at(-1) ?? '')) words.pop()
  return (words.at(-1) ?? '').replace(/,$/, '')
}

/** The running head keeps a title short: whole words, up to ~30 characters. */
function shortTitle(title: string): string {
  if (title.length <= 30) return title
  let out = ''
  for (const word of title.split(/\s+/)) {
    const next = out ? `${out} ${word}` : word
    if (next.length > 30) break
    out = next
  }
  return out || title.slice(0, 30)
}

const LANGUAGE_TAG = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/

function wordLanguage(language: string | undefined): string {
  const tag = language?.trim() ?? ''
  if (!LANGUAGE_TAG.test(tag)) return 'en-US'
  return tag.toLowerCase() === 'en' ? 'en-US' : tag
}

function displayDate(value: string, language: string): string {
  const date = w3cDate(value)
  if (!date) return value.trim()
  if (/^\d{4}$/.test(date)) return date
  try {
    const monthOnly = /^\d{4}-\d{2}$/.test(date)
    return new Intl.DateTimeFormat(language, {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      ...(monthOnly ? {} : { day: 'numeric' }),
    }).format(new Date(monthOnly ? `${date}-01` : date))
  } catch {
    return date
  }
}

const chapterTitle = (chapter: ExportChapter, index: number) =>
  chapter.title.trim() || `Chapter ${index + 1}`

function chapterBody(chapter: ExportChapter, ctx: Ctx): string {
  ctx.notes = new Map()
  for (const block of chapter.doc?.content ?? []) {
    if (block.type !== 'footnotes') continue
    for (const note of block.content ?? []) {
      const id = note.attrs?.id
      if (typeof id === 'string' && !ctx.notes.has(id)) ctx.notes.set(id, note)
    }
  }
  ctx.noteIds = new Map()
  ctx.afterBreak = true
  let xml = blocks(chapter.doc?.content, ctx, BODY_SCOPE)
  // Bookmarks queued by a block that produced no paragraph.
  if (ctx.pending.length > 0) xml += paragraph(ctx, {}, '')
  return xml
}

/**
 * Builds a .docx of the whole book. 'manuscript' follows standard manuscript
 * format: a title page with the word count, then each chapter on a new page a
 * third of the way down, "#" scene breaks, a "Surname / Title / page" running
 * head, and "END". 'document' is a clean document with real heading styles
 * and captions, for papers and reports.
 */
export async function buildDocx(book: ExportBook, options: DocxOptions = {}): Promise<Uint8Array> {
  const theme = options.format === 'document' ? DOCUMENT : MANUSCRIPT
  const page = PAGES[options.pageSize ?? 'letter']
  const textWidth = page.width - 2 * MARGIN
  const modified = options.modified ?? new Date()
  const title = book.title.trim() || 'Untitled'
  const subtitle = book.subtitle?.trim() ?? ''
  const author = book.author.trim()
  const language = wordLanguage(book.language)
  const words = countBookWords(book)

  // Images to embed, and which block ids links point at (they get bookmarks).
  const sources = new Set<string>()
  const ids = new Set<string>()
  const targets = new Set<string>()
  for (const chapter of book.chapters) {
    walk(chapter.doc, (node) => {
      if (node.type === 'image') {
        const src = sanitizeUrl(node.attrs?.src, { allowData: true })
        if (src) sources.add(src)
      }
      const id = node.attrs?.id
      if (typeof id === 'string' && id) ids.add(bookmarkName(id))
      for (const mark of node.marks ?? []) {
        const href = mark.type === 'link' ? sanitizeUrl(mark.attrs?.href) : null
        if (href?.startsWith('#') && href.length > 1) targets.add(bookmarkName(href.slice(1)))
      }
    })
  }
  const loaded = await loadImages(sources, options.fetchImage)
  const media = new Map<string, Media>()
  for (const src of sources) {
    const image = loaded.get(src)
    if (!image || !DOCX_IMAGE_TYPES.has(image.mediaType)) continue
    const name = `image${media.size + 1}.${imageExtension(image.mediaType)}`
    media.set(src, { name, image, size: imageSize(image) })
  }

  const documentRels = relations()
  documentRels.add(REL.styles, 'styles.xml')
  documentRels.add(REL.settings, 'settings.xml')
  documentRels.add(REL.numbering, 'numbering.xml')
  documentRels.add(REL.footnotes, 'footnotes.xml')
  const headerId = documentRels.add(REL.header, 'header1.xml')

  const ctx: Ctx = {
    theme,
    page,
    textWidth,
    media,
    usedMedia: new Set(),
    rels: { document: documentRels, footnotes: relations() },
    numbering: { abstracts: [], nums: [], tasks: new Map() },
    footnotes: [],
    nextFootnote: 1,
    notes: new Map(),
    noteIds: new Map(),
    pending: [],
    anchors: new Set([...targets].filter((name) => ids.has(name))),
    anchored: new Set(),
    nextBookmark: 0,
    nextDrawing: 1,
    afterBreak: true,
    headingShift: 0,
  }

  const groups = groupChapters(book.chapters)
  const hasParts = groups.some((group) => group.part)
  let body = ''

  if (theme.manuscript) {
    // Title page: name top left, word count top right, title halfway down.
    // It is its own section, so the running head starts on chapter one's page.
    const halfway = Math.round(page.height / 2) - MARGIN - 520
    body += paragraph(
      ctx,
      { style: 'TitlePageInfo', tabs: [{ type: 'right', pos: textWidth }] },
      `${run(author)}${TAB_RUN}${run(approximateWordCount(words))}`
    )
    body += paragraph(ctx, { style: 'Title', before: halfway }, run(title))
    if (subtitle) body += paragraph(ctx, { style: 'Subtitle' }, run(subtitle))
    body += paragraph(
      ctx,
      { style: 'Author', sectPr: sectPr(ctx) },
      author ? run(`by ${author}`) : ''
    )

    const third = Math.round(page.height / 3) - MARGIN
    const chapterOutline = hasParts ? 1 : 0
    ctx.headingShift = chapterOutline + 1
    // The section break already starts a page.
    let pageBreak = false
    for (const group of groups) {
      if (group.part) {
        body += paragraph(
          ctx,
          { style: 'PartTitle', pageBreakBefore: pageBreak, before: third, outline: 0 },
          run(group.part)
        )
        pageBreak = true
      }
      for (const { chapter, index } of group.chapters) {
        body += paragraph(
          ctx,
          {
            style: 'ChapterTitle',
            pageBreakBefore: pageBreak,
            before: third,
            outline: chapterOutline,
          },
          run(chapterTitle(chapter, index))
        )
        pageBreak = true
        body += chapterBody(chapter, ctx)
      }
    }
    body += paragraph(ctx, { style: 'SceneBreak' }, book.chapters.length > 0 ? run('END') : '')
    body += sectPr(ctx, { header: headerId, start: 1 })
  } else {
    body += paragraph(ctx, { style: 'Title' }, run(title))
    if (subtitle) body += paragraph(ctx, { style: 'Subtitle' }, run(subtitle))
    if (author) body += paragraph(ctx, { style: 'Author' }, run(author))
    if (book.date?.trim()) {
      body += paragraph(ctx, { style: 'Date' }, run(displayDate(book.date, language)))
    }

    const chapterLevel = hasParts ? 2 : 1
    const single = book.chapters.length === 1
    let started = false
    let afterPart = false
    for (const group of groups) {
      if (group.part) {
        body += paragraph(ctx, { style: 'Heading1', pageBreakBefore: started }, run(group.part))
        started = true
        afterPart = true
      }
      for (const { chapter, index } of group.chapters) {
        // A paper is one chapter, usually titled like the paper itself.
        const name = chapter.title.trim()
        const hidden = single && (!name || name.toLowerCase() === title.toLowerCase())
        if (!hidden) {
          body += paragraph(
            ctx,
            { style: `Heading${chapterLevel}`, pageBreakBefore: started && !afterPart },
            run(chapterTitle(chapter, index))
          )
        }
        ctx.headingShift = hidden ? chapterLevel - 1 : chapterLevel
        started = true
        afterPart = false
        body += chapterBody(chapter, ctx)
      }
    }
    body += sectPr(ctx, { header: headerId })
  }

  const header = theme.manuscript
    ? `${[surname(author), options.shortTitle?.trim() || shortTitle(title)].filter(Boolean).join(' / ')} / `
    : ''

  const mediaFiles = [...media.values()].filter((item) => ctx.usedMedia.has(item))
  const extensions = new Map(
    mediaFiles.map((item) => [imageExtension(item.image.mediaType), item.image.mediaType])
  )
  const contentTypes = `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${[
    ...extensions,
  ]
    .map(([extension, type]) => `<Default Extension="${extension}" ContentType="${type}"/>`)
    .join(
      ''
    )}<Override PartName="/word/document.xml" ContentType="${CONTENT_TYPE}.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="${CONTENT_TYPE}.styles+xml"/><Override PartName="/word/settings.xml" ContentType="${CONTENT_TYPE}.settings+xml"/><Override PartName="/word/numbering.xml" ContentType="${CONTENT_TYPE}.numbering+xml"/><Override PartName="/word/footnotes.xml" ContentType="${CONTENT_TYPE}.footnotes+xml"/><Override PartName="/word/header1.xml" ContentType="${CONTENT_TYPE}.header+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`

  const packageRels = relations()
  packageRels.add(REL.document, 'word/document.xml')
  packageRels.add(REL.core, 'docProps/core.xml')
  packageRels.add(REL.app, 'docProps/app.xml')

  const stamp = isoSeconds(modified)
  const core = `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(
    title
  )}</dc:title>${subtitle ? `<dc:subject>${escapeXml(subtitle)}</dc:subject>` : ''}${
    author
      ? `<dc:creator>${escapeXml(author)}</dc:creator><cp:lastModifiedBy>${escapeXml(author)}</cp:lastModifiedBy>`
      : ''
  }${book.description?.trim() ? `<dc:description>${escapeXml(book.description.trim())}</dc:description>` : ''}<dc:language>${escapeXml(
    language
  )}</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified></cp:coreProperties>`
  const app = `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Lemma</Application><Words>${words}</Words>${
    book.publisher?.trim() ? `<Company>${escapeXml(book.publisher.trim())}</Company>` : ''
  }</Properties>`

  const numbering = `${XML_HEADER}<w:numbering ${NAMESPACES}>${ctx.numbering.abstracts.join(
    ''
  )}${ctx.numbering.nums.join('')}</w:numbering>`
  const document = `${XML_HEADER}<w:document ${NAMESPACES}><w:body>${body}</w:body></w:document>`

  return createZip(
    [
      { path: '[Content_Types].xml', data: contentTypes },
      { path: '_rels/.rels', data: relationshipsXml(packageRels.list) },
      { path: 'docProps/core.xml', data: core },
      { path: 'docProps/app.xml', data: app },
      { path: 'word/document.xml', data: document },
      { path: 'word/styles.xml', data: stylesXml(theme, language, textWidth) },
      { path: 'word/settings.xml', data: settingsXml(language) },
      { path: 'word/numbering.xml', data: numbering },
      { path: 'word/footnotes.xml', data: footnotesXml(ctx.footnotes) },
      { path: 'word/header1.xml', data: headerXml(header) },
      { path: 'word/_rels/document.xml.rels', data: relationshipsXml(documentRels.list) },
      ...(ctx.rels.footnotes.list.length > 0
        ? [
            {
              path: 'word/_rels/footnotes.xml.rels',
              data: relationshipsXml(ctx.rels.footnotes.list),
            },
          ]
        : []),
      ...mediaFiles.map((item) => ({
        path: `word/media/${item.name}`,
        data: item.image.data,
        store: true,
      })),
    ],
    { date: modified }
  )
}
