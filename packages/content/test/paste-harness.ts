// Paste-fidelity harness: replays a paste through the schema parser (the steps
// prosemirror-view's parseFromClipboard takes) and classifies source and result
// with a port of the Phase A study's classifier (lemma-editor-study/scripts/paste.mjs).
// DOM-only, so the same code runs under happy-dom (bun test) and in Chromium
// (paste-chromium.ts).

import {
  DOMSerializer,
  Fragment,
  DOMParser as PMDOMParser,
  type Node as PMNode,
  type Schema,
  Slice,
} from '@tiptap/pm/model'
import katex from 'katex'

import { getContentSchema } from '../src/schema'
import { normalizePastedHTML } from '../src/schema/paste'

export type Classification = ReturnType<typeof classify>

// Port of classify() from scripts/paste.mjs. Differences, all because happy-dom
// can't evaluate `:not(<complex selector>)`: hidden/math/katex tests are done
// with closest() instead of selectors. Additions (marked) count the canonical
// footnote and task markup the schema serializes, which the original selectors
// predate.
export function classify(root: Element) {
  const out = {
    words: 0,
    chars: 0,
    alnum: 0,
    bold: 0,
    italic: 0,
    underline: 0,
    strike: 0,
    code: 0,
    link: 0,
    color: 0,
    highlight: 0,
    headings: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 } as Record<string, number>,
    listItems: 0,
    maxListDepth: 0,
    tasks: 0,
    tableCells: 0,
    tables: 0,
    blockquotes: 0,
    codeBlocks: 0,
    images: 0,
    imageSrc: { http: 0, data: 0, other: 0 },
    math: 0,
    footnoteRefs: 0,
    internalLinks: 0,
    hr: 0,
    // Additions.
    footnotes: 0,
    text: '',
    junkText: [] as string[],
  }
  const isHidden = (el: Element) =>
    el.matches('style,script,annotation,annotation-xml,.mw-editsection') ||
    (el.getAttribute('aria-hidden') === 'true' && !el.parentElement?.closest('.katex-html'))
  const styleOf = (el: Element) => (el.getAttribute('style') ?? '').toLowerCase()
  const rgb = (v: string) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(v)
    if (m) return { r: +m[1]!, g: +m[2]!, b: +m[3]!, a: m[4] === undefined ? 1 : +m[4] }
    const h = /#([0-9a-f]{6}|[0-9a-f]{3})\b/.exec(v)
    if (!h) return null
    const x =
      h[1]!.length === 3
        ? h[1]!
            .split('')
            .map((c) => c + c)
            .join('')
        : h[1]!
    return {
      r: Number.parseInt(x.slice(0, 2), 16),
      g: Number.parseInt(x.slice(2, 4), 16),
      b: Number.parseInt(x.slice(4, 6), 16),
      a: 1,
    }
  }
  const isGrey = (c: { r: number; g: number; b: number }) =>
    Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 24
  const realColor = (s: string) => {
    const m = /(?:^|;)\s*color:\s*([^;]+)/.exec(s)
    const c = m && rgb(m[1]!)
    return !!c && !isGrey(c)
  }
  const realHighlight = (s: string) => {
    const m = /background(?:-color)?:\s*([^;]+)/.exec(s)
    const c = m && rgb(m[1]!)
    return !!c && c.a > 0.05 && !(isGrey(c) && c.r > 200)
  }
  const doc = root.ownerDocument
  const tw = doc.createTreeWalker(root, 4 /* SHOW_TEXT */)
  const texts: string[] = []
  for (let t = tw.nextNode(); t; t = tw.nextNode()) {
    const content = t.textContent ?? ''
    if (!content.trim()) continue
    let hidden = false
    for (let e = t.parentElement; e && e !== root.parentElement; e = e.parentElement) {
      if (isHidden(e)) {
        hidden = true
        break
      }
    }
    if (hidden) continue
    texts.push(content)
    const n = content.replace(/\s+/g, ' ').length
    out.chars += n
    out.words += content.trim().split(/\s+/).length
    out.alnum += (content.match(/[\p{L}\p{N}]/gu) ?? []).length
    let bold = false
    let italic = false
    let underline = false
    let strike = false
    let code = false
    let link = false
    let color = false
    let highlight = false
    let inHeadOrTh = false
    let inPre = false
    let boldDecided: boolean | null = null
    for (let e = t.parentElement; e && e !== root; e = e.parentElement) {
      const tag = e.tagName.toLowerCase()
      const s = styleOf(e)
      if (/^h[1-6]$/.test(tag) || tag === 'th') inHeadOrTh = true
      if (boldDecided === null) {
        const fw = /(?:^|;)\s*font-weight:\s*([^;]+)/.exec(s)
        if (fw) boldDecided = /bold|[6-9]00/.test(fw[1]!)
        else if (tag === 'b' || tag === 'strong') boldDecided = true
      }
      bold = boldDecided === true
      if (tag === 'i' || tag === 'em' || /font-style:\s*italic/.test(s)) italic = true
      if (tag === 'u' || (/text-decoration[^;]*underline/.test(s) && tag !== 'a')) underline = true
      if (tag === 's' || tag === 'strike' || tag === 'del' || /line-through/.test(s)) strike = true
      if (
        tag === 'code' ||
        tag === 'pre' ||
        tag === 'kbd' ||
        /font-family:[^;]*(mono|courier|consolas)/.test(s)
      )
        code = true
      if (tag === 'a' && e.getAttribute('href')) link = true
      if (tag === 'mark' || realHighlight(s)) highlight = true
      if (realColor(s)) color = true
      if (tag === 'pre') inPre = true
    }
    if (bold && !inHeadOrTh && !inPre) out.bold += n
    if (italic && !inPre) out.italic += n
    if (underline && !inPre) out.underline += n
    if (strike && !inPre) out.strike += n
    if (code) out.code += n
    if (link) out.link += n
    if (color && !inPre) out.color += n
    if (highlight && !inPre && !code) out.highlight += n
    if (/mso-|@font-face|\{[^}]*:[^}]*\}|<\/?[a-z]+[ >]|&nbsp;/i.test(content))
      out.junkText.push(content.slice(0, 60))
  }
  out.text = texts.join(' ')
  for (const h of root.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    out.headings[h.tagName.toLowerCase()]!++
  for (const h of root.querySelectorAll(
    '[role="heading"],p[class^="MsoHeading"],p[class*="Heading"]'
  )) {
    const lvl =
      Number(h.getAttribute('aria-level')) || Number((h.className.match(/(\d)/) ?? [])[1]) || 2
    out.headings[`h${Math.min(6, lvl)}`]!++
  }
  for (const li of root.querySelectorAll('li')) {
    out.listItems++
    let d = 0
    for (let e: Element | null = li; e && e !== root; e = e.parentElement) {
      if (e.tagName === 'UL' || e.tagName === 'OL') d++
    }
    out.maxListDepth = Math.max(out.maxListDepth, d)
  }
  // `input[type="checkbox"],li[data-type="taskItem"],[data-checked]`, counting a
  // rendered task item (li + its checkbox) once.
  for (const el of root.querySelectorAll(
    'input[type="checkbox"],li[data-type="taskItem"],[data-checked]'
  )) {
    if (el.localName === 'input' && el.closest('li[data-type="taskItem"],li[data-checked]'))
      continue
    out.tasks++
  }
  out.tables = root.querySelectorAll('table').length
  out.tableCells = root.querySelectorAll('td,th').length
  out.blockquotes = root.querySelectorAll('blockquote').length
  out.codeBlocks = root.querySelectorAll('pre').length
  out.hr = root.querySelectorAll('hr').length
  for (const img of root.querySelectorAll('img')) {
    // ProseMirror-separator: the editor's caret helper after a trailing inline atom.
    if (img.closest('math,.katex,.mwe-math-element') || img.matches('.ProseMirror-separator'))
      continue
    out.images++
    const src = img.getAttribute('src') ?? ''
    if (/^https?:|^\/\//.test(src)) out.imageSrc.http++
    else if (src.startsWith('data:')) out.imageSrc.data++
    else out.imageSrc.other++
  }
  // `math:not(math math),.katex:not(.katex .katex),span[data-type="math"],[data-latex]`,
  // counting a rendered math node once rather than once per wrapper.
  for (const el of root.querySelectorAll('math,.katex,span[data-type="math"],[data-latex]')) {
    const outer = el.parentElement?.closest('math,.katex,span[data-type="math"],[data-latex]')
    if (!outer || !root.contains(outer)) out.math++
  }
  out.footnoteRefs = root.querySelectorAll(
    'sup a[href^="#"],a[href^="#_ftn"],a[href^="#ftnt"],a[href*="cite_note"],.ltx_note_mark,.ltx_cite,sup[data-footnote-ref]'
  ).length
  out.footnotes = root.querySelectorAll('ol[data-footnotes] > li').length
  out.internalLinks = root.querySelectorAll('a[href^="#"]').length
  out.junkText = out.junkText.slice(0, 5)
  return out
}

const schema: Schema = getContentSchema()
const parser = PMDOMParser.fromSchema(schema)
const serializer = DOMSerializer.fromSchema(schema)
const inlineParents =
  /^(a|abbr|acronym|b|cite|code|del|em|i|ins|kbd|label|output|q|ruby|s|samp|span|strong|sub|sup|time|u|tt|var)$/i

// prosemirror-view's readHTML: drop leading <meta>s, parse into a detached div.
function readHTML(html: string): HTMLElement {
  const metas = /^(\s*<meta [^>]*>)*/.exec(html)
  if (metas) html = html.slice(metas[0].length)
  const element = document.implementation.createHTMLDocument('title').createElement('div')
  element.innerHTML = html
  return element
}

export type PasteResult = {
  slice: Slice
  /** The slice serialized with the schema's toDOM, math rendered as the editor's node view would. */
  dom: HTMLElement
  droppedImages: number
}

/**
 * Paste `html` the way the editor does: transformPastedHTML → readHTML →
 * parseSlice into an empty paragraph → wrap stray top-level inline nodes (what
 * normalizeSiblings does with, say, a <br> between two <p>s).
 */
export function pasteSlice(
  html: string,
  { normalize = true } = {}
): { slice: Slice; droppedImages: number } {
  let droppedImages = 0
  if (normalize) {
    const cleaned = normalizePastedHTML(html)
    html = cleaned.html
    droppedImages = cleaned.droppedImages
  }
  const context = schema.node('doc', null, [schema.node('paragraph')]).resolve(1)
  // `ruleFromNode` isn't in ParseOptions' types; prosemirror-view passes it all the same.
  const options = {
    preserveWhitespace: false,
    context,
    ruleFromNode(dom: Node) {
      const parent = dom.parentNode
      if (
        dom.nodeName === 'BR' &&
        !dom.nextSibling &&
        parent &&
        !inlineParents.test(parent.nodeName)
      ) {
        return { ignore: true }
      }
      return null
    },
  }
  const slice = parser.parseSlice(readHTML(html), options)
  const wrapped = wrapInline(slice.content)
  return {
    slice: wrapped === slice.content ? slice : Slice.maxOpen(wrapped, true),
    droppedImages,
  }
}

/** pasteSlice, plus the result rendered to DOM for classify(). */
export function pasteHTML(html: string, options: { normalize?: boolean } = {}): PasteResult {
  const { slice, droppedImages } = pasteSlice(html, options)
  return { slice, dom: toDOM(slice), droppedImages }
}

function wrapInline(content: Fragment): Fragment {
  if (content.childCount < 2 || !content.content.some((node) => node.isBlock)) return content
  const out: PMNode[] = []
  let run: PMNode[] = []
  const flush = () => {
    if (run.length > 0) out.push(schema.node('paragraph', null, run))
    run = []
  }
  content.forEach((node) => {
    if (node.isInline) run.push(node)
    else {
      flush()
      out.push(node)
    }
  })
  flush()
  return Fragment.from(out)
}

export function toDOM(slice: Slice): HTMLElement {
  const host = document.createElement('div')
  host.appendChild(serializer.serializeFragment(slice.content, { document }))
  for (const el of host.querySelectorAll('[data-latex]')) {
    const latex = el.getAttribute('data-latex') ?? ''
    el.innerHTML = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: el.getAttribute('data-type') === 'block-math',
    })
  }
  return host
}

/** Classify the pasted source the way the study did: attached to the page, in a div. */
export function classifyHTML(html: string): Classification {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  const result = classify(host)
  host.remove()
  return result
}

/** Classify an element in the page (attaching it for the duration if it isn't). */
export function classifyElement(element: HTMLElement): Classification {
  if (element.isConnected) return classify(element)
  document.body.appendChild(element)
  const out = classify(element)
  element.remove()
  return out
}

type Container = { forEach: Fragment['forEach'] }

/**
 * Blank paragraphs (empty, or holding only line breaks: what a top-level <br>
 * became in Phase A) at the top level, and the longest run of them at any depth
 * (where a table cell's required lone paragraph is a run of one).
 */
export function blankParagraphs(content: Fragment): { top: number; longestRun: number } {
  const isBlank = (node: PMNode) =>
    node.type.name === 'paragraph' &&
    node.content.content.every((child) => child.type.name === 'hardBreak')
  let top = 0
  let longestRun = 0
  const visit = (parent: Container, depth: number) => {
    let run = 0
    parent.forEach((child) => {
      if (isBlank(child)) {
        if (depth === 0) top++
        run++
        longestRun = Math.max(longestRun, run)
      } else {
        run = 0
        if (!child.isTextblock && !child.isLeaf) visit(child, depth + 1)
      }
    })
  }
  visit(content, 0)
  return { top, longestRun }
}

export function nodeCounts(content: Fragment): Record<string, number> {
  const counts: Record<string, number> = {}
  content.descendants((node) => {
    counts[node.type.name] = (counts[node.type.name] ?? 0) + 1
    return true
  })
  return counts
}
