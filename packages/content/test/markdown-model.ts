import type { JSONContent } from '@tiptap/core'

import type { MarkdownLossFeature } from '../src'

/**
 * An independent model of what Markdown can't carry, for the round-trip
 * property: `withoutMarkdownLoss(doc)` removes exactly those features (and
 * counts them the way markdownLoss reports them), so whatever is left must
 * come back from markdownToContent(renderToMarkdown(doc)) unchanged.
 *
 * Deliberately written without reusing src/markdown.ts.
 */

type Json = JSONContent
type Counts = Map<MarkdownLossFeature, number>

/** Same order as markdownLoss reports features in. */
const FEATURES: MarkdownLossFeature[] = [
  'textColor',
  'highlight',
  'underline',
  'emptyParagraph',
  'emptyMath',
  'mathLineBreak',
  'orderedListType',
  'imageSize',
  'videoStartTime',
  'videoSize',
  'tableColumnWidth',
  'tableCellSpan',
  'tableHeaders',
  'tableCellBlocks',
  'tableMathPipe',
  'trailingSpace',
]

const DROPPED: Record<string, MarkdownLossFeature> = {
  textStyle: 'textColor',
  highlight: 'highlight',
  underline: 'underline',
}

const add = (counts: Counts, feature: MarkdownLossFeature, n = 1) => {
  if (n > 0) counts.set(feature, (counts.get(feature) ?? 0) + n)
}

const paragraph = (content: Json[] = []): Json =>
  content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' }

const isEmptyParagraph = (node: Json) => node.type === 'paragraph' && !node.content?.length

function mergeText(items: Json[]): Json[] {
  const out: Json[] = []
  for (const item of items) {
    const last = out[out.length - 1]
    if (
      item.type === 'text' &&
      last?.type === 'text' &&
      JSON.stringify(last.marks ?? []) === JSON.stringify(item.marks ?? [])
    ) {
      out[out.length - 1] = { ...last, text: `${last.text}${item.text}` }
    } else {
      out.push(item)
    }
  }
  return out
}

/** Inline math can't hold a line break; it's written as a space. */
const inlineTex = (latex: string) => latex.replace(/\n/g, ' ')

// GFM turns \| into | inside a table cell, even in code and math.
const unescapePipes = (tex: string) => tex.replace(/(?<!\\)((?:\\\\)*)\\\|/g, '$1|')

function inline(content: Json[] | undefined, counts: Counts, inCell = false): Json[] {
  content ??= []
  for (const [type, feature] of Object.entries(DROPPED)) {
    let inRun = false
    for (const node of content) {
      const has = (node.marks ?? []).some((mark) => mark.type === type)
      if (has && !inRun) add(counts, feature)
      inRun = has
    }
  }
  const out: Json[] = []
  for (const node of content) {
    let next: Json = node
    const marks = (node.marks ?? []).filter((mark) => !DROPPED[mark.type])
    if (node.marks) {
      const { marks: _marks, ...rest } = node
      next = marks.length > 0 ? { ...rest, marks } : rest
    }
    if (node.type === 'inlineMath') {
      const latex = String(node.attrs?.latex ?? '')
      if (!latex) {
        add(counts, 'emptyMath')
        continue
      }
      let tex = inlineTex(latex)
      if (tex !== latex) add(counts, 'mathLineBreak')
      if (inCell && unescapePipes(tex) !== tex) {
        add(counts, 'tableMathPipe')
        tex = unescapePipes(tex)
      }
      next = { ...next, attrs: { ...next.attrs, latex: tex } }
    }
    out.push(next)
  }
  const merged = mergeText(out)
  // Trailing spaces at the end of a block are dropped, unless they are all
  // the block holds.
  const last = merged[merged.length - 1]
  if (last?.type === 'text') {
    const trimmed = (last.text ?? '').replace(/ +$/, '')
    if (trimmed !== last.text && (trimmed !== '' || merged.length > 1)) {
      add(counts, 'trailingSpace')
      if (trimmed === '') merged.pop()
      else merged[merged.length - 1] = { ...last, text: trimmed }
    }
  }
  return merged
}

/** Empty paragraphs vanish; a container left with none gets one back. */
function blocks(nodes: Json[] | undefined, counts: Counts, refill = true): Json[] {
  nodes ??= []
  const out = nodes.map((child) => block(child, counts))
  const kept = out.filter((child) => !isEmptyParagraph(child))
  const empty = out.length - kept.length
  if (kept.length === 0 && refill && empty > 0) {
    add(counts, 'emptyParagraph', empty - 1)
    return [paragraph()]
  }
  add(counts, 'emptyParagraph', empty)
  return kept
}

function block(node: Json, counts: Counts): Json {
  const attrs = { ...node.attrs }
  switch (node.type) {
    case 'paragraph':
    case 'heading': {
      const content = inline(node.content, counts)
      const { content: _content, ...rest } = node
      return content.length > 0 ? { ...rest, content } : rest
    }
    case 'listItem':
    case 'taskItem': {
      // The required first paragraph comes back empty by itself, unless (in a
      // non-task item) a paragraph follows and takes its place.
      const [first, ...rest] = node.content ?? []
      let lead = block(first ?? paragraph(), counts)
      let tail = blocks(rest, counts, false)
      if (node.type === 'listItem' && isEmptyParagraph(lead) && tail[0]?.type === 'paragraph') {
        add(counts, 'emptyParagraph')
        lead = tail[0]
        tail = tail.slice(1)
      }
      return { ...node, content: [lead, ...tail] }
    }
    case 'orderedList':
      if (attrs.type != null) add(counts, 'orderedListType')
      return { ...node, attrs: { ...attrs, type: null }, content: blocks(node.content, counts) }
    case 'image':
      if (attrs.width != null || attrs.height != null) add(counts, 'imageSize')
      return { ...node, attrs: { ...attrs, width: null, height: null } }
    case 'youtube':
      if (Number(attrs.start) > 0) add(counts, 'videoStartTime')
      if (attrs.width !== 640 || attrs.height !== 480) add(counts, 'videoSize')
      return { ...node, attrs: { ...attrs, start: 0, width: 640, height: 480 } }
    case 'table':
      return table(node, counts)
    case 'footnotes':
      return { ...node, content: (node.content ?? []).map((note) => block(note, counts)) }
    default:
      return node.content ? { ...node, content: blocks(node.content, counts) } : node
  }
}

/** Where each cell sits on the table's grid (prosemirror-tables' TableMap). */
function grid(table: Json): (Json | null)[][] {
  const rows = table.content ?? []
  const cells: (Json | null | undefined)[][] = rows.map(() => [])
  rows.forEach((row, r) => {
    let c = 0
    for (const cell of row.content ?? []) {
      while (cells[r]?.[c] !== undefined) c++
      const colspan = Number(cell.attrs?.colspan ?? 1)
      const rowspan = Number(cell.attrs?.rowspan ?? 1)
      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          const line = cells[r + dr]
          if (line) line[c + dc] = dr === 0 && dc === 0 ? cell : null
        }
      }
      c += colspan
    }
  })
  const width = Math.max(1, ...cells.map((line) => line.length))
  return cells.map((line) => Array.from({ length: width }, (_, c) => line[c] ?? null))
}

/** A cell's text blocks, however nested, as lines; code keeps its text. */
function cellLines(nodes: Json[] | undefined, counts: Counts): Json[][] {
  return (nodes ?? []).flatMap((node): Json[][] => {
    if (node.type === 'paragraph' || node.type === 'heading')
      return [inline(node.content, counts, true)]
    if (node.type === 'codeBlock') {
      const text = node.content?.[0]?.text ?? ''
      if (!text) return []
      const line: Json[] = []
      text.split('\n').forEach((part, index) => {
        if (index > 0) line.push({ type: 'hardBreak' })
        if (part) line.push({ type: 'text', text: part, marks: [{ type: 'code' }] })
      })
      return [line]
    }
    if (node.type === 'blockMath') {
      const tex = inlineTex(String(node.attrs?.latex ?? ''))
      if (unescapePipes(tex) !== tex) add(counts, 'tableMathPipe')
      return tex ? [[{ type: 'inlineMath', attrs: { latex: unescapePipes(tex) } }]] : []
    }
    return node.content ? cellLines(node.content, counts) : []
  })
}

function table(node: Json, counts: Counts): Json {
  const cells = grid(node)
  let widths = false
  const rows = cells.map((line, r) => ({
    type: 'tableRow',
    content: line.map((cell) => {
      const type = r === 0 ? 'tableHeader' : 'tableCell'
      if (!cell) return { type, content: [paragraph()] }
      if (cell.attrs?.colwidth != null) widths = true
      if (Number(cell.attrs?.colspan) > 1 || Number(cell.attrs?.rowspan) > 1)
        add(counts, 'tableCellSpan')
      if (cell.type !== type) add(counts, 'tableHeaders')
      const content = cell.content ?? []
      const [only] = content
      if (content.length === 1 && only?.type === 'paragraph') {
        return { type, content: [paragraph(inline(only.content, counts, true))] }
      }
      add(counts, 'tableCellBlocks')
      const lines = cellLines(content, counts).filter((line) => line.length > 0)
      const joined = lines.flatMap((line, i) => (i > 0 ? [{ type: 'hardBreak' }, ...line] : line))
      return { type, content: [paragraph(mergeText(joined))] }
    }),
  }))
  if (widths) add(counts, 'tableColumnWidth')
  return { type: 'table', content: rows }
}

export function withoutMarkdownLoss(doc: Json): {
  doc: Json
  losses: { feature: MarkdownLossFeature; count: number }[]
} {
  const counts: Counts = new Map()
  const body = (doc.content ?? []).filter((node) => node.type !== 'footnotes')
  const notes = (doc.content ?? []).find((node) => node.type === 'footnotes')
  const content = blocks(body, counts)
  if (notes) content.push(block(notes, counts))
  return {
    doc: { ...doc, content },
    losses: FEATURES.filter((feature) => counts.has(feature)).map((feature) => ({
      feature,
      count: counts.get(feature) ?? 0,
    })),
  }
}

/**
 * Footnote ids are identity: Markdown numbers notes [^1], [^2]… by first
 * reference, and reads them back as fn-1, fn-2…. Renumber both sides alike.
 */
export function renumberFootnotes(doc: Json): Json {
  const ids = new Map<string, string>()
  const collect = (node: Json) => {
    if (node.type === 'footnotes') return
    const id = node.attrs?.id
    if (node.type === 'footnoteReference' && typeof id === 'string' && !ids.has(id))
      ids.set(id, `fn-${ids.size + 1}`)
    node.content?.forEach(collect)
  }
  collect(doc)
  const rename = (node: Json): Json => {
    const out: Json = { ...node }
    const id = node.attrs?.id
    if ((node.type === 'footnoteReference' || node.type === 'footnote') && typeof id === 'string')
      out.attrs = { ...node.attrs, id: ids.get(id) ?? id }
    if (node.content) out.content = node.content.map(rename)
    return out
  }
  return rename(doc)
}
