import { Extension } from '@tiptap/core'
import { Fragment, type Node as PMNode, type Schema, Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'

import { markdownToContent } from '../markdown-parse'
import { newFootnoteId } from './footnotes'
import { MONOSPACE } from './marks'
import { validateContent } from './validate'

// Clipboard HTML is rewritten into the markup the schema's parse rules already
// understand, before ProseMirror parses it. Every rule keys off markup a
// specific source writes, so pastes from anywhere else pass through untouched:
//   Google Docs   <b id="docs-internal-guid-…"> wrapper, monospace-font "code"
//                 paragraphs, <br> blank lines, #ftnt footnotes
//   Word          #_ftn / #_edn footnotes and endnotes, comment anchors,
//                 mso-list paragraphs, mso-highlight, cell shading behind white
//                 text, file:// images
//   LaTeXML       span.ltx_note footnotes, cite.ltx_cite citations
//   Notion        to-do blocks (public pages) and "[ ]" items (app), inline
//                 <div>s, attachment: images
//   any           links to #anchors (no element ids survive the parse),
//                 images the reader could never load, runs of empty paragraphs

export type NormalizedPaste = { html: string; droppedImages: number }

// Classic DOM calls only: the web app's types merge Cloudflare's HTMLRewriter
// `Element` into the DOM's, which breaks append/before/after/replaceWith.
function appendAll(parent: Node, children: Iterable<Node>): void {
  for (const child of Array.from(children)) parent.appendChild(child)
}

function replaceNode(old: Node, ...replacements: Node[]): void {
  const parent = old.parentNode
  if (!parent) return
  for (const node of replacements) parent.insertBefore(node, old)
  parent.removeChild(old)
}

// prosemirror-view wraps table fragments this way before parsing; doing the same
// keeps a pasted cell range a cell range.
const TABLE_WRAP: Record<string, string[]> = {
  thead: ['table'],
  tbody: ['table'],
  tfoot: ['table'],
  caption: ['table'],
  colgroup: ['table', 'colgroup'],
  col: ['table', 'colgroup'],
  tr: ['table', 'tbody'],
  td: ['table', 'tbody', 'tr'],
  th: ['table', 'tbody', 'tr'],
}

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'dd',
  'details',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
])

// Content that makes an otherwise text-less block worth keeping.
const SUBSTANCE =
  'img,hr,math,input,iframe,video,audio,svg,object,embed,canvas,table,pre,sup[data-footnote-ref],[data-latex],[data-type]'

// "[1]", "1", "iv", "*", "†": what a note marker looks like (a TOC link doesn't).
const NOTE_MARKER = /^[[(]?\s*(\d{1,4}|[a-z]|[ivxlcdm]{1,7}|[*†‡§¶#]{1,3})\s*[\])]?$/i
// Anything but whitespace, no-break spaces and zero-width characters.
const VISIBLE = /[^\s\u00a0\u200b\u200c\ufeff]/
const hasVisibleText = (text: string | null) => VISIBLE.test(text ?? '')
const FOLLOWING = 4 // Node.DOCUMENT_POSITION_FOLLOWING

type Note = { id: string; body: Element }

type Context = {
  doc: Document
  root: HTMLElement
  base: string | null
  droppedImages: number
  notes: Note[]
  // Google Docs marks paragraph spacing with blank lines; Lemma's typography
  // already spaces paragraphs, so those blank lines are dropped entirely.
  dropBlankLines: boolean
}

/**
 * Rewrite clipboard HTML from Google Docs, Word, LaTeXML (arXiv), Notion and
 * friends into markup the content schema parses faithfully. Runs in the
 * browser before ProseMirror parses a paste (see PasteCleanup).
 */
export function normalizePastedHTML(html: string): NormalizedPaste {
  // Lemma's own (or another ProseMirror editor's) clipboard is canonical already.
  if (!html || typeof DOMParser === 'undefined' || /\sdata-pm-slice=/.test(html)) {
    return { html, droppedImages: 0 }
  }

  const source = html.replace(/^(\s*<meta [^>]*>)*/i, '')
  const firstTag = /<([a-z][^>\s]+)/i.exec(source)?.[1]?.toLowerCase()
  const wrap = firstTag ? TABLE_WRAP[firstTag] : undefined
  const wrapped = wrap
    ? `${wrap.map((tag) => `<${tag}>`).join('')}${source}${[...wrap]
        .reverse()
        .map((tag) => `</${tag}>`)
        .join('')}`
    : source

  const doc = new DOMParser().parseFromString(wrapped, 'text/html')
  let root = doc.body
  for (const tag of wrap ?? []) root = root.querySelector<HTMLElement>(tag) ?? root

  const baseHref = doc.querySelector('base[href]')?.getAttribute('href') ?? ''
  const cx: Context = {
    doc,
    root,
    base: /^https?:\/\//i.test(baseHref) ? baseHref : null,
    droppedImages: 0,
    notes: [],
    dropBlankLines: root.querySelector('b[id^="docs-internal-guid-"]') !== null,
  }
  try {
    cleanUp(cx)
  } catch (error) {
    // Markup no rule anticipated must never cost the writer the paste itself.
    console.warn('Paste cleanup failed; pasting as is.', error)
    return { html, droppedImages: 0 }
  }
  return { html: root.innerHTML, droppedImages: cx.droppedImages }
}

function cleanUp(cx: Context) {
  const { root } = cx
  for (const wrapper of root.querySelectorAll('b[id^="docs-internal-guid-"]')) unwrap(wrapper)

  // One walk over the fragment; each rule then works on its own bucket.
  const images: HTMLElement[] = []
  const vml: Element[] = []
  const vmlFallbacks = new Set<string>()
  const links: HTMLElement[] = []
  const anchors = new Map<string, Element>()
  const latexmlNotes: Element[] = []
  const wordComments: Element[] = []
  const wordNoteLists: Element[] = []
  const wordListItems: HTMLElement[] = []
  const notionTodos: Element[] = []
  const codeBoxes: HTMLElement[] = []
  const lists: Element[] = []
  const styled: HTMLElement[] = []
  const containers = new Set<Element>()
  // Most pastes have no monospace text at all; then there are no code paragraphs to find.
  let monospace = false

  for (const el of Array.from(root.getElementsByTagName('*')) as HTMLElement[]) {
    // tagName, not localName: parsers disagree on the localName of Word's <v:shape>.
    const tag = el.tagName.toLowerCase()
    if (el.id) anchors.set(el.id, el)
    const style = el.getAttribute('style')
    if (style !== null) {
      styled.push(el)
      if (!monospace) monospace = MONOSPACE.test(/font-family:\s*([^;]*)/i.exec(style)?.[1] ?? '')
    }
    switch (tag) {
      case 'a': {
        const name = el.getAttribute('name')
        if (name && !anchors.has(name)) anchors.set(name, el)
        if (el.classList.contains('msocomanchor')) wordComments.push(el)
        else if (el.hasAttribute('href')) links.push(el)
        break
      }
      case 'img': {
        images.push(el)
        for (const shape of (el.getAttribute('v:shapes') ?? '').split(/\s+/)) {
          if (shape) vmlFallbacks.add(shape)
        }
        break
      }
      case 'v:imagedata':
        vml.push(el)
        break
      case 'span':
        if (el.classList.contains('ltx_note')) latexmlNotes.push(el)
        break
      case 'ul':
        lists.push(el)
        break
      case 'div':
        if (/mso-element:\s*comment-list/i.test(style ?? '')) wordComments.push(el)
        else if (/mso-element:\s*(foot|end)note-list/i.test(style ?? '')) wordNoteLists.push(el)
        else if (el.classList.contains('notion-to_do-block')) notionTodos.push(el)
        else if (/white-space:\s*pre/i.test(style ?? '') && isMonospaceBlock(el)) codeBoxes.push(el)
        break
      case 'code':
      case 'kbd':
      case 'samp':
      case 'tt':
        monospace = true
        break
      case 'p':
        if (style && /mso-list:\s*l\d/i.test(style)) wordListItems.push(el)
        if (el.parentElement) containers.add(el.parentElement)
        break
      case 'br':
        if (el.parentElement) containers.add(el.parentElement)
        break
    }
  }

  // A manual page break (Word) means nothing on a web page.
  for (const br of root.querySelectorAll('br[style*="page-break"], br[style*="break-before"]')) {
    removeWithEmptyAncestors(br, root)
  }
  // ChatGPT wraps a CodeMirror <pre> in its own UI <pre> (header, copy button):
  // keep the inner one, or the outer pre's whitespace leaks into later blocks.
  for (const pre of Array.from(root.querySelectorAll('pre'))) {
    const inner = pre.isConnected ? pre.querySelector('pre') : null
    if (inner) replaceNode(pre, inner)
  }
  for (const comment of wordComments) removeWithEmptyAncestors(comment, root)
  convertWordLists(cx, wordListItems)
  for (const box of codeBoxes) if (box.isConnected) replaceNode(box, codeBlock(cx, codeText(box)))
  // Notes go to a list at the very end, so only when the paste is a whole fragment.
  if (root === cx.doc.body) {
    convertLatexmlNotes(cx, latexmlNotes)
    convertAnchorNotes(cx, links, anchors, wordNoteLists)
  }
  for (const link of links) {
    if (!link.isConnected) continue
    // The schema keeps no element ids, so an in-page link can never resolve.
    if ((link.getAttribute('href') ?? '').trim().startsWith('#')) unwrap(link)
    else cleanLinkStyles(link)
  }
  for (const img of images) if (img.isConnected) checkImage(cx, img)
  // Word's VML pictures; the <img> fallback next to them (if any) was handled above.
  for (const data of vml) {
    const shape =
      data.parentElement?.tagName.toLowerCase() === 'v:shape' ? data.parentElement : data
    const hasFallback = shape.id !== '' && vmlFallbacks.has(shape.id)
    if (!hasFallback && !loadableSrc(cx, data.getAttribute('src') ?? '')) cx.droppedImages++
    shape.remove()
  }
  for (const el of styled) if (el.isConnected) normalizeStyle(el, root)
  for (const todo of notionTodos.reverse()) if (todo.isConnected) convertNotionTodo(cx, todo)
  mergeAdjacentTaskLists(root)
  for (const list of lists) if (list.isConnected) convertTaskItems(cx, list)
  for (const container of containers) {
    if (!container.isConnected || container.closest('pre')) continue
    if (monospace && !container.closest('li,td,th,dd,dt')) convertMonospaceRuns(cx, container)
    collapseEmptyBlocks(cx, container)
  }
  appendFootnotes(cx)
}

// ---------------------------------------------------------------------------
// Footnotes

/** LaTeXML (arXiv HTML): the whole note sits inline, after its mark. */
function convertLatexmlNotes(cx: Context, notes: Element[]) {
  for (const note of notes) {
    if (!note.isConnected) continue
    const content = note.querySelector('.ltx_note_content')
    const mark = note.querySelector('.ltx_note_mark')?.textContent?.trim() ?? ''
    if (!content) continue
    for (const junk of content.querySelectorAll('.ltx_note_mark, .ltx_note_type, .ltx_tag_note')) {
      junk.remove()
    }
    if (!hasSubstance(content)) {
      // \footnotemark: points at another note by number; keep what the reader saw.
      replaceNode(note, superscript(cx, mark))
      continue
    }
    const id = newFootnoteId()
    cx.notes.push({ id, body: content })
    replaceNode(note, reference(cx, id))
  }
}

/**
 * Footnotes as a pair of links: a marker pointing at the note, and the note
 * linking back. Word (#_ftn1 ↔ #_ftnref1), Google Docs (#ftnt1 ↔ #ftnt_ref1),
 * Pandoc/markdown-it (#fn1 ↔ #fnref1) all have this shape.
 */
function convertAnchorNotes(
  cx: Context,
  links: HTMLElement[],
  anchors: Map<string, Element>,
  wordNoteLists: Element[]
) {
  type Pair = { ref: HTMLElement; body: Element; backlink: Element }
  const pairs: Pair[] = []
  const refs = new Set<Element>()

  for (const ref of links) {
    const href = ref.getAttribute('href') ?? ''
    // Disconnected: inside something already removed (a Word comment body).
    if (!ref.isConnected || !href.startsWith('#') || href.length < 2) continue
    const isWord =
      /^#_(ftn|edn)\d/.test(href) || /mso-(foot|end)note-id/i.test(ref.getAttribute('style') ?? '')
    if (!isWord && !NOTE_MARKER.test(visibleText(ref))) continue
    const target = anchors.get(safeDecode(href.slice(1)))
    if (!target || target === ref || target.contains(ref)) continue
    // Notes follow their references; the link pointing back up is the backlink.
    if (!(ref.compareDocumentPosition(target) & FOLLOWING)) continue
    const backlink = backlinkTo(ref, target)
    if (!backlink) continue
    pairs.push({ ref, body: target, backlink })
    refs.add(ref)
  }
  // A note cited twice links back to its first reference only.
  const backlinks = new Map(pairs.map((pair) => [pair.body, pair.backlink]))
  for (const ref of links) {
    const href = ref.getAttribute('href') ?? ''
    if (refs.has(ref) || !ref.isConnected || !href.startsWith('#')) continue
    if (!NOTE_MARKER.test(visibleText(ref))) continue
    const target = anchors.get(safeDecode(href.slice(1)))
    const backlink = target && backlinks.get(target)
    if (!target || !backlink || !(ref.compareDocumentPosition(target) & FOLLOWING)) continue
    pairs.push({ ref, body: target, backlink })
    refs.add(ref)
  }

  // The note body is the nearest block around the target that holds no other
  // note and no reference: Word's div#ftn1, Pandoc's li#fn1, a Docs <div>/<p>.
  const targets = new Set(pairs.map((pair) => pair.body))
  const bodyOf = new Map<Element, Element>()
  for (const target of targets) {
    let body: Element | null = null
    for (const selector of ['li', 'div', 'p']) {
      const candidate = target.closest(selector)
      if (
        candidate &&
        candidate !== cx.root &&
        cx.root.contains(candidate) &&
        holdsOnly(candidate, target, targets, refs)
      ) {
        body = candidate
        break
      }
    }
    if (body) bodyOf.set(target, body)
  }

  const ids = new Map<Element, string>()
  const separators = new Set<Element>()
  for (const { ref, body: target, backlink } of pairs) {
    const body = bodyOf.get(target)
    if (!body) continue
    let id = ids.get(body)
    if (!id) {
      id = newFootnoteId()
      ids.set(body, id)
      removeMarker(backlink, body)
      // Take the note out, then whatever list/section held it if that's now bare,
      // remembering any rule that introduced the notes.
      let removed: Element = body
      let parent = body.parentElement
      for (;;) {
        const rule = previousElement(removed)
        if (rule?.localName === 'hr') separators.add(rule)
        removed.remove()
        if (!parent || parent === cx.root || !onlyRules(parent)) break
        removed = parent
        parent = parent.parentElement
      }
      cx.notes.push({ id, body })
    }
    replaceMarker(ref, reference(cx, id))
  }

  // Word note references whose body wasn't copied: keep the number, lose the dead link.
  for (const ref of links) {
    if (!ref.isConnected || refs.has(ref)) continue
    const href = ref.getAttribute('href') ?? ''
    if (/^#_(ftn|edn)\d/.test(href) && !/^#_(ftn|edn)ref/.test(href)) {
      replaceMarker(ref, superscript(cx, visibleText(ref).replace(/^\[(.*)\]$/, '$1')))
    }
  }

  for (const list of wordNoteLists) {
    if (!list.isConnected) continue
    for (const rule of list.querySelectorAll('hr, br')) rule.remove()
    if (hasSubstance(list)) unwrap(list)
    else list.remove()
  }
  // A separator rule left at the very end once the notes below it moved out.
  for (const rule of separators) {
    if (rule.isConnected && !nextElementWithSubstance(rule)) rule.remove()
  }
}

function backlinkTo(ref: Element, target: Element): Element | null {
  const keys = new Set<string>()
  for (let el: Element | null = ref; el && keys.size < 4; el = el.parentElement) {
    if (el.id) keys.add(el.id)
    const name = el.getAttribute('name')
    if (name) keys.add(name)
    if (el.localName !== 'a' && el.localName !== 'sup' && el.localName !== 'span') break
  }
  if (keys.size === 0) return null
  const pointsBack = (el: Element) => {
    const href = el.getAttribute('href') ?? ''
    return href.startsWith('#') && keys.has(safeDecode(href.slice(1)))
  }
  if (target.localName === 'a' && pointsBack(target)) return target
  for (const link of target.querySelectorAll('a[href^="#"]')) if (pointsBack(link)) return link
  // Pandoc puts the backlink at the end of the note, not inside the target element.
  const holder = target.closest('li, div, p')
  if (holder)
    for (const link of holder.querySelectorAll('a[href^="#"]')) if (pointsBack(link)) return link
  return null
}

function holdsOnly(candidate: Element, target: Element, targets: Set<Element>, refs: Set<Element>) {
  for (const other of targets) if (other !== target && candidate.contains(other)) return false
  for (const ref of refs) if (candidate.contains(ref)) return false
  return true
}

/** Drop the "[1]" / "↩" back-link (and a <sup> that only held it) from a note body. */
function removeMarker(backlink: Element, body: Element) {
  let marker: Element = backlink
  while (
    marker.parentElement &&
    marker.parentElement !== body &&
    /^(sup|span)$/.test(marker.parentElement.localName) &&
    !visibleText(marker.parentElement).replace(visibleText(marker), '').trim()
  ) {
    marker = marker.parentElement
  }
  marker.remove()
  // The space after the marker ("[1] Note text") would lead the note.
  const walker = body.ownerDocument.createTreeWalker(body, 4)
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const value = text.nodeValue ?? ''
    const trimmed = value.replace(/^[\s\u00a0]+/, '')
    text.nodeValue = trimmed
    if (trimmed) break
  }
}

/** Swap a reference link for the footnote node, taking a <sup> that only held it. */
function replaceMarker(ref: Element, replacement: Element) {
  const parent = ref.parentElement
  if (parent?.localName === 'sup' && !visibleText(parent).replace(visibleText(ref), '').trim()) {
    replaceNode(parent, replacement)
  } else {
    replaceNode(ref, replacement)
  }
}

function reference(cx: Context, id: string): Element {
  const sup = cx.doc.createElement('sup')
  sup.setAttribute('data-footnote-ref', '')
  sup.setAttribute('data-id', id)
  return sup
}

function superscript(cx: Context, text: string): Element {
  const sup = cx.doc.createElement('sup')
  sup.textContent = text
  return sup
}

function appendFootnotes(cx: Context) {
  if (cx.notes.length === 0) return
  const byId = new Map(cx.notes.map((note) => [note.id, note]))
  const list = cx.doc.createElement('ol')
  list.setAttribute('data-footnotes', '')
  const seen = new Set<string>()
  for (const ref of cx.root.querySelectorAll('sup[data-footnote-ref]')) {
    const id = ref.getAttribute('data-id') ?? ''
    const note = byId.get(id)
    if (!note || seen.has(id)) continue
    seen.add(id)
    const item = cx.doc.createElement('li')
    item.setAttribute('data-footnote-id', id)
    for (const paragraph of toParagraphs(cx, note.body)) item.appendChild(paragraph)
    for (const link of item.querySelectorAll('a[href^="#"]')) unwrap(link)
    list.appendChild(item)
  }
  if (list.childElementCount > 0) cx.root.appendChild(list)
}

/** A footnote holds paragraphs only; flatten whatever block structure the note had. */
function toParagraphs(cx: Context, body: Element): Element[] {
  const out: Element[] = []
  let current: Element | null = null
  const flush = () => {
    if (current && hasSubstance(current)) out.push(current)
    current = null
  }
  const visit = (parent: Element) => {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === 1 && BLOCK_TAGS.has((child as Element).localName)) {
        flush()
        visit(child as Element)
        flush()
      } else {
        current ??= cx.doc.createElement('p')
        current.appendChild(child)
      }
    }
  }
  visit(body)
  flush()
  if (out.length === 0) out.push(cx.doc.createElement('p'))
  return out
}

// ---------------------------------------------------------------------------
// Links, images, styles

/**
 * Google Docs and Word restate the default link blue and underline on every
 * link's text; stored, they'd outlive the link and ignore the theme.
 */
function cleanLinkStyles(link: HTMLElement) {
  for (const span of link.querySelectorAll<HTMLElement>('span[style]')) {
    if (/underline/i.test(span.style.textDecoration)) span.style.removeProperty('text-decoration')
    if (isLinkBlue(span.style.color)) span.style.removeProperty('color')
  }
}

function isLinkBlue(value: string): boolean {
  const rgb = value ? parseColor(value) : null
  if (!rgb && /^blue$/i.test(value.trim())) return true
  return rgb !== null && rgb[2] >= 150 && rgb[2] - Math.max(rgb[0], rgb[1]) >= 50
}

function checkImage(cx: Context, img: HTMLElement) {
  const src = loadableSrc(cx, img.getAttribute('src') ?? '')
  if (src) {
    if (src !== img.getAttribute('src')) img.setAttribute('src', src)
    return
  }
  cx.droppedImages++
  removeWithEmptyAncestors(img, cx.root)
}

/** The URL a reader's browser could actually fetch, or null. */
function loadableSrc(cx: Context, raw: string): string | null {
  const src = raw.trim()
  if (!src) return null
  if (/^data:image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml)[;,]/i.test(src)) return src
  if (/^https?:\/\//i.test(src) || src.startsWith('//')) return src
  if (/^blob:/i.test(src)) {
    const origin = globalThis.location?.origin
    return origin && origin !== 'null' && src.startsWith(`blob:${origin}/`) ? src : null
  }
  // file:, cid:, attachment: (Notion), webkit-fake-url: (Safari), …
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return null
  if (cx.base) {
    try {
      return new URL(src, cx.base).href
    } catch {
      return null
    }
  }
  return src.startsWith('/') ? src : null
}

const LIGHT_TEXT_SKIP = /^(pre|code)$/

function normalizeStyle(el: HTMLElement, root: HTMLElement) {
  const raw = el.getAttribute('style') ?? ''

  // Word's highlighter: mso-highlight, usually (not always) restated as a background.
  const msoHighlight = /mso-highlight:\s*([a-z]+|#[0-9a-f]{3,6})/i.exec(raw)?.[1]
  if (msoHighlight && !/^(none|auto)$/i.test(msoHighlight) && !el.style.backgroundColor) {
    el.style.backgroundColor = msoHighlight
  }

  // An inline <div> (Notion's inline-code container) would split the paragraph.
  if (el.localName === 'div' && /display:\s*inline\s*(;|$)/i.test(raw)) {
    const span = el.ownerDocument.createElement('span')
    span.setAttribute('style', raw)
    for (const child of Array.from(el.childNodes)) span.appendChild(child)
    replaceNode(el, span)
    return
  }

  // Near-white text is only readable on the shading it came with. Carry a cell's
  // or block's background down as a highlight; with no backdrop, drop the colour.
  const color = /(?:^|;)\s*color:\s*([^;]+)/i.exec(raw)?.[1]
  if (!color || !isLight(color) || backgroundOf(el)) return
  for (let up = el.parentElement; up && up !== root.parentElement; up = up.parentElement) {
    if (LIGHT_TEXT_SKIP.test(up.localName)) return
    const backdrop = backgroundOf(up)
    if (!backdrop) continue
    if (isLight(backdrop)) break
    el.style.backgroundColor = backdrop
    return
  }
  el.style.removeProperty('color')
}

function backgroundOf(el: Element): string | null {
  const value = (
    (el as HTMLElement).style?.backgroundColor ||
    el.getAttribute('bgcolor') ||
    ''
  ).trim()
  if (!value || /^(transparent|initial|inherit|unset|none|currentcolor)$/i.test(value)) return null
  return /^rgba\(.*[,/]\s*0(\.0*)?\s*\)$/i.test(value) ? null : value
}

function isLight(value: string): boolean {
  const rgb = parseColor(value)
  return rgb !== null && 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] > 215
}

function parseColor(value: string): [number, number, number] | null {
  const color = value.trim().toLowerCase()
  if (color === 'white' || color === 'window') return [255, 255, 255]
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(color)?.[1]
  if (hex) {
    const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex
    return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [
      number,
      number,
      number,
    ]
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/.exec(color)
  if (!rgb) return null
  const alpha =
    rgb[4] === undefined ? 1 : Number.parseFloat(rgb[4]) / (rgb[4].endsWith('%') ? 100 : 1)
  if (alpha < 0.05) return null
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
}

// ---------------------------------------------------------------------------
// Lists

// "1." "a)" "iv." — Word's typed-out marker for a numbered item; anything else is a bullet glyph.
const ORDERED_MARKER = /^\(?(\d{1,3}|[a-z]|[ivxlcdm]{1,6})[.)]$/i

/**
 * Word writes a list as paragraphs styled `mso-list:l1 level2 lfo3`, the bullet
 * or number typed out in a `mso-list:Ignore` span. Rebuild the nested lists.
 */
function convertWordLists(cx: Context, paragraphs: HTMLElement[]) {
  type Open = { level: number; list: Element; ordered: boolean }
  let stack: Open[] = []
  let previous: Element | null = null
  for (const p of paragraphs) {
    if (!p.isConnected) continue
    if (previous === null || p.previousElementSibling !== previous) stack = []
    const level = Number(/level(\d+)/i.exec(p.getAttribute('style') ?? '')?.[1] ?? 1)
    const marker = Array.from(p.querySelectorAll<HTMLElement>('[style*="mso-list"]')).find((el) =>
      /mso-list:\s*ignore/i.test(el.getAttribute('style') ?? '')
    )
    const label = (marker?.textContent ?? '').replace(/[\s\u00a0]+/g, ' ').trim()
    const ordered = ORDERED_MARKER.test(label)
    marker?.remove()

    const newList = () => {
      const list = cx.doc.createElement(ordered ? 'ol' : 'ul')
      const start = Number.parseInt(label, 10)
      if (ordered && start > 1) list.setAttribute('start', String(start))
      return list
    }
    while (stack.length > 0 && stack[stack.length - 1]!.level > level) stack.pop()
    let top = stack[stack.length - 1]
    if (top && top.level === level && top.ordered !== ordered) {
      stack.pop()
      const sibling = newList()
      top.list.parentNode?.insertBefore(sibling, top.list.nextSibling)
      top = { level, list: sibling, ordered }
      stack.push(top)
    } else if (!top || top.level < level) {
      const list = newList()
      if (top?.list.lastElementChild) top.list.lastElementChild.appendChild(list)
      else p.parentNode?.insertBefore(list, p)
      top = { level, list, ordered }
      stack.push(top)
    }
    const item = cx.doc.createElement('li')
    // The paragraph moves into the item; the list now sits where it was.
    const anchor = stack[0]!.list
    top.list.appendChild(item)
    item.appendChild(p)
    previous = anchor
  }
}

// Task lists

/** Notion public pages: div.notion-to_do-block holding a checkbox and the text. */
function convertNotionTodo(cx: Context, block: Element) {
  const checkbox = block.querySelector('input[type="checkbox"]')
  const leaf = block.querySelector('[data-content-editable-leaf]')
  const paragraph = cx.doc.createElement('p')
  if (leaf) appendAll(paragraph, leaf.childNodes)
  const checked =
    !!checkbox &&
    (checkbox.hasAttribute('checked') ||
      checkbox.getAttribute('aria-checked') === 'true' ||
      /line-through/.test(leaf?.getAttribute('style') ?? ''))
  const item = taskItem(cx, checked)
  item.appendChild(paragraph)
  // Nested blocks (sub-to-dos, paragraphs) come along under the item.
  for (const child of block.querySelectorAll('.notion-selectable')) {
    if (child.parentElement?.closest('.notion-selectable') === block) item.appendChild(child)
  }
  const list = cx.doc.createElement('ul')
  list.setAttribute('data-type', 'taskList')
  list.appendChild(item)
  replaceNode(block, list)
}

function taskItem(cx: Context, checked: boolean): Element {
  const item = cx.doc.createElement('li')
  item.setAttribute('data-type', 'taskItem')
  item.setAttribute('data-checked', String(checked))
  return item
}

/** Notion wraps every block in its own <div>s; join to-dos that were next to each other. */
function mergeAdjacentTaskLists(root: HTMLElement) {
  const outermost = (list: Element): Element => {
    let el = list
    while (
      el.parentElement &&
      el.parentElement !== root &&
      el.parentElement.childElementCount === 1 &&
      !ownText(el.parentElement)
    ) {
      el = el.parentElement
    }
    return el
  }
  const innerList = (el: Element | null): Element | null => {
    while (el && el.localName !== 'ul' && el.childElementCount === 1 && !ownText(el))
      el = el.firstElementChild
    return el?.localName === 'ul' && el.getAttribute('data-type') === 'taskList' ? el : null
  }
  for (const list of Array.from(root.querySelectorAll('ul[data-type="taskList"]'))) {
    if (!list.isConnected) continue
    let next = innerList(outermost(list).nextElementSibling)
    while (next) {
      const slot = outermost(next)
      appendAll(list, next.children)
      const after = slot.nextElementSibling
      slot.remove()
      next = innerList(after)
    }
  }
}

/**
 * "[ ]" / "[x]" items (Notion's app clipboard, Markdown renderers) and items
 * led by a checkbox (GitHub) become task items; mixed lists are split.
 */
function convertTaskItems(cx: Context, list: Element) {
  if (list.getAttribute('data-type') === 'taskList') return
  const items = Array.from(list.children).filter((child) => child.localName === 'li')
  const states = items.map(taskState)
  if (!states.some((state) => state !== null)) return

  const lists: Element[] = []
  let current: Element | null = null
  let currentIsTask = false
  items.forEach((item, index) => {
    const state = states[index] ?? null
    const isTask = state !== null
    if (!current || isTask !== currentIsTask) {
      current = cx.doc.createElement('ul')
      if (isTask) current.setAttribute('data-type', 'taskList')
      lists.push(current)
      currentIsTask = isTask
    }
    if (isTask) {
      item.setAttribute('data-type', 'taskItem')
      item.setAttribute('data-checked', String(state))
    }
    current.appendChild(item)
  })
  replaceNode(list, ...lists)
}

function taskState(item: Element): boolean | null {
  const first = firstContent(item)
  if (!first) return null
  if (first.nodeType === 1 && (first as Element).matches('input[type="checkbox"]')) {
    const checked = (first as Element).hasAttribute('checked')
    first.parentNode?.removeChild(first)
    return checked
  }
  if (first.nodeType !== 3) return null
  const match = /^\s*\[([ xX])\](?=\s|$)\s*/.exec(first.nodeValue ?? '')
  if (!match) return null
  first.nodeValue = (first.nodeValue ?? '').slice(match[0].length)
  return match[1] !== ' '
}

/** The first text or checkbox inside an item, looking through paragraph and span wrappers. */
function firstContent(el: Element): ChildNode | null {
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) {
      if ((child.nodeValue ?? '').trim()) return child
      continue
    }
    if (child.nodeType !== 1) continue
    const element = child as Element
    if (element.localName === 'input') return element as unknown as ChildNode
    if (/^(p|span|label|div|b|strong)$/.test(element.localName)) return firstContent(element)
    return null
  }
  return null
}

// ---------------------------------------------------------------------------
// Block runs: code paragraphs, empty paragraphs

type Item = { node: ChildNode; kind: 'code' | 'empty' | 'other' }

function blockItems(container: Element, detectCode: boolean): Item[] | null {
  const items: Item[] = []
  let hasBlock = false
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === 3) {
      if ((node.nodeValue ?? '').trim()) items.push({ node, kind: 'other' })
      continue
    }
    if (node.nodeType !== 1) continue
    const el = node as HTMLElement
    const tag = el.localName
    if (BLOCK_TAGS.has(tag)) hasBlock = true
    if (tag === 'br') items.push({ node, kind: 'empty' })
    else if (tag === 'p' && isEmptyBlock(el)) items.push({ node, kind: 'empty' })
    else if (detectCode && tag === 'p' && isMonospaceParagraph(el))
      items.push({ node, kind: 'code' })
    else items.push({ node, kind: 'other' })
  }
  if (!hasBlock) return null
  // A <br> between inline content is a line break, not a blank line.
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    if (item.node.nodeName !== 'BR') continue
    // Images and rules are blocks in the schema (collapseEmptyBlocks lifts
    // them out of their paragraphs), so a <br> beside one is a blank line.
    const isInline = (neighbour: Item | undefined) =>
      neighbour !== undefined &&
      neighbour.node.nodeName !== 'BR' &&
      (neighbour.node.nodeType === 3 ||
        !(
          BLOCK_TAGS.has((neighbour.node as Element).localName) ||
          (neighbour.node as Element).localName === 'img' ||
          (neighbour.node as Element).localName === 'hr'
        ))
    if (isInline(items[i - 1]) || isInline(items[i + 1])) item.kind = 'other'
  }
  return items
}

/** Google Docs "code" is a paragraph set entirely in a monospace font. */
function convertMonospaceRuns(cx: Context, container: Element) {
  const items = blockItems(container, true)
  if (!items?.some((item) => item.kind === 'code')) return
  let i = 0
  while (i < items.length) {
    if (items[i]!.kind !== 'code') {
      i++
      continue
    }
    let end = i
    for (let j = i + 1; j < items.length && items[j]!.kind !== 'other'; j++) {
      if (items[j]!.kind === 'code') end = j
    }
    const lines = items
      .slice(i, end + 1)
      .map((item) => (item.kind === 'code' ? codeText(item.node as Element) : ''))
    container.replaceChild(codeBlock(cx, lines.join('\n')), items[i]!.node)
    for (const item of items.slice(i + 1, end + 1)) item.node.remove()
    i = end + 1
  }
}

function isMonospaceParagraph(p: Element): boolean {
  if (p.querySelector(SUBSTANCE)) return false
  let sawText = false
  const walker = p.ownerDocument.createTreeWalker(p, 4)
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    if (!hasVisibleText(text.nodeValue)) continue
    if (!inMonospace(text.parentElement, p)) return false
    sawText = true
  }
  return sawText
}

/** VS Code and JetBrains copy code as nested <div>s in a monospace, white-space:pre box. */
function isMonospaceBlock(div: HTMLElement): boolean {
  return (
    /pre/.test(div.style.whiteSpace) &&
    MONOSPACE.test(div.style.fontFamily) &&
    !div.querySelector(SUBSTANCE) &&
    !div.closest('pre')
  )
}

function codeBlock(cx: Context, text: string): Element {
  const pre = cx.doc.createElement('pre')
  const code = cx.doc.createElement('code')
  code.textContent = text
  pre.appendChild(code)
  return pre
}

function inMonospace(el: Element | null, stop: Element): boolean {
  for (; el && el !== stop.parentElement; el = el.parentElement) {
    if (/^(code|kbd|samp|tt)$/.test(el.localName)) return true
    const family = (el as HTMLElement).style?.fontFamily
    if (family) return MONOSPACE.test(family)
  }
  return false
}

function codeText(el: Element): string {
  let out = ''
  const visit = (node: Node) => {
    if (node.nodeType === 3) out += (node.nodeValue ?? '').replace(/\u00a0/g, ' ')
    else if (node.nodeName === 'BR') out += '\n'
    else if (node.nodeType === 1) {
      const block = node !== el && (node as Element).localName === 'div'
      if (block && out && !out.endsWith('\n')) out += '\n'
      node.childNodes.forEach(visit)
    }
  }
  visit(el)
  return out.replace(/\n$/, '')
}

/**
 * At most one empty paragraph in a row, none at the edges and none beside a
 * rule; none at all from Google Docs (see Context.dropBlankLines).
 */
function collapseEmptyBlocks(cx: Context, container: Element) {
  // Images and rules are blocks in the schema: a paragraph holding nothing else
  // would only leave an empty paragraph behind. (Browsers already split <p><hr>.)
  for (const child of Array.from(container.children)) {
    if (child.localName !== 'p' || hasVisibleText(child.textContent)) continue
    const inside = Array.from(child.querySelectorAll(SUBSTANCE))
    if (
      inside.length > 0 &&
      inside.every((el) => el.localName === 'img' || el.localName === 'hr')
    ) {
      replaceNode(child, ...inside.filter((el) => !el.parentElement?.closest('img, hr')))
    }
  }
  const items = blockItems(container, false)
  if (!items) return
  const keep = items.map(() => true)
  const isRule = (item: Item | undefined) => item?.node.nodeName === 'HR'
  const first = items.findIndex((item) => item.kind !== 'empty')
  let last = items.length - 1
  while (last >= 0 && items[last]?.kind === 'empty') last--
  if (first === -1) {
    // Nothing but blank lines (say, after an unloadable image went): paste nothing.
    if (container === cx.root) for (const item of items) item.node.remove()
    return
  }
  items.forEach((item, index) => {
    if (item.kind !== 'empty') return
    if (cx.dropBlankLines || index < first || index > last) keep[index] = false
    else if (items[index - 1]?.kind === 'empty') keep[index] = false
    else if (isRule(items[index - 1]) || isRule(nextNonEmpty(items, index))) keep[index] = false
  })
  items.forEach((item, index) => {
    if (!keep[index]) {
      item.node.remove()
    } else if (item.kind === 'empty') {
      // A blank line between blocks is an empty paragraph: not a stray line
      // break, and not Word's <p><o:p>&nbsp;</o:p></p> with its no-break space.
      item.node.parentNode?.replaceChild(cx.doc.createElement('p'), item.node)
    }
  })
}

function nextNonEmpty(items: Item[], index: number): Item | undefined {
  for (let i = index + 1; i < items.length; i++) if (items[i]!.kind !== 'empty') return items[i]
  return undefined
}

// ---------------------------------------------------------------------------
// DOM helpers

function isEmptyBlock(el: Element): boolean {
  return !hasVisibleText(el.textContent) && !el.querySelector(SUBSTANCE)
}

function hasSubstance(el: Element): boolean {
  return !isEmptyBlock(el)
}

/** Nothing left but separator rules and line breaks. */
function onlyRules(el: Element): boolean {
  if (hasVisibleText(el.textContent)) return false
  for (const found of el.querySelectorAll(SUBSTANCE)) if (found.localName !== 'hr') return false
  return true
}

function visibleText(el: Element): string {
  return (el.textContent ?? '').replace(/\u00a0/g, ' ').trim()
}

function ownText(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3 && (node.nodeValue ?? '').trim()) return true
  }
  return false
}

function unwrap(el: Element) {
  replaceNode(el, ...Array.from(el.childNodes))
}

function removeWithEmptyAncestors(el: Element, root: Element) {
  let parent = el.parentElement
  el.remove()
  while (parent && parent !== root && !BLOCK_TAGS.has(parent.localName) && isEmptyBlock(parent)) {
    const next = parent.parentElement
    parent.remove()
    parent = next
  }
}

function previousElement(el: Element): Element | null {
  let prev = el.previousElementSibling
  while (prev && prev.localName === 'br') prev = prev.previousElementSibling
  return prev
}

function nextElementWithSubstance(el: Element): Element | null {
  for (let next = el.nextElementSibling; next; next = next.nextElementSibling) {
    if (hasSubstance(next)) return next
  }
  for (let up = el.parentElement; up && up.localName !== 'body'; up = up.parentElement) {
    for (let next = up.nextElementSibling; next; next = next.nextElementSibling) {
      if (hasSubstance(next)) return next
    }
  }
  return null
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// ---------------------------------------------------------------------------
// Markdown in text/plain

const MARKDOWN_SIGNALS = [
  /^#{1,6}[ \t]+\S/m, // ATX heading
  /^(```|~~~)[^\n]*\n[\s\S]*?\n\1[ \t]*$/m, // fenced code
  /^\s*\|?[ \t]*:?-{3,}:?[ \t]*(\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*$/m, // table divider
  /^\$\$[\s\S]+?\$\$[ \t]*$/m, // display math
  /(^|[^\w*])\*\*(?=\S)[^*\n]+?\S\*\*(?!\w)/, // **bold**
  /\[[^\]\n]+\]\((https?:\/\/|mailto:)[^)\s]+\)/, // [link](url)
  /^\[\^[^\]\s]+\]:/m, // footnote definition
]
const LIST_LINE = /^[ \t]*([-*+]|\d{1,3}[.)])[ \t]+\S/gm

/** Conservative: plain prose, URLs, code and shell output don't trip it. */
export function looksLikeMarkdown(text: string): boolean {
  if (text.length > 500_000 || !/\n|\*\*|\]\(/.test(text)) return false
  if (MARKDOWN_SIGNALS.some((signal) => signal.test(text))) return true
  return (text.match(LIST_LINE)?.length ?? 0) >= 2
}

/**
 * Markdown → slice. Validated block by block: the lenient validator flattens a
 * document it can't repair, and one odd block shouldn't flatten the whole paste.
 */
export function markdownSlice(text: string, schema: Schema): Slice {
  const nodes: PMNode[] = []
  for (const block of markdownToContent(text).content ?? []) {
    // A footnotes list can't stand alone in a document; give it a block to follow.
    const doc =
      block.type === 'footnotes'
        ? { type: 'doc', content: [{ type: 'paragraph' }, block] }
        : { type: 'doc', content: [block] }
    const valid = validateContent(doc).content ?? []
    for (const child of block.type === 'footnotes' ? valid.slice(1) : valid) {
      nodes.push(schema.nodeFromJSON(child))
    }
  }
  return Slice.maxOpen(Fragment.from(nodes))
}

// ---------------------------------------------------------------------------
// Extension

export type PasteCleanupOptions = {
  /** Called when pasted images had to be dropped (local files, attachments, …). */
  onDroppedImages?: (count: number) => void
  /** Parse Markdown that arrives as plain text only (no HTML on the clipboard). */
  markdown: boolean
}

export const PasteCleanup = Extension.create<PasteCleanupOptions>({
  name: 'pasteCleanup',

  addOptions() {
    return { onDroppedImages: undefined, markdown: true }
  },

  addProseMirrorPlugins() {
    const { onDroppedImages, markdown } = this.options
    return [
      new Plugin({
        key: new PluginKey('pasteCleanup'),
        props: {
          transformPastedHTML: (html) => {
            const result = normalizePastedHTML(html)
            if (result.droppedImages > 0) onDroppedImages?.(result.droppedImages)
            return result.html
          },
          // ProseMirror only asks for this when there's no HTML, or on Shift+paste
          // (`plain`), which must stay plain.
          clipboardTextParser: (text, _$context, plain, view) => {
            if (!markdown || plain || !looksLikeMarkdown(text)) return null as unknown as Slice
            try {
              return markdownSlice(text, view.state.schema)
            } catch {
              return null as unknown as Slice
            }
          },
        },
      }),
    ]
  },
})
