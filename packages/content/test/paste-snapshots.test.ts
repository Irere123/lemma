// Paste snapshots: one fixture per captured clipboard source (Google Docs, Word,
// LaTeXML/arXiv, Notion, ChatGPT, Wikipedia), replayed through the editor's paste
// pipeline. The fixtures are committed (fixtures/paste: scrubbed captures plus
// hand-written Word HTML, see its README), so unlike the Phase A corpus block in
// paste.test.ts these run everywhere, CI included.
//
// Each fixture gets the corpus targets, explicit expectations for what its source
// must keep, and a snapshot of the pasted ProseMirror JSON so any change in paste
// behaviour shows up in review. Known paste bugs are pinned with `test.failing`
// (labelled BUG): they assert the correct behaviour, so fixing one flips the test.

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Editor, type JSONContent } from '@tiptap/core'

import { contentExtensions } from '../src/schema'
import { normalizePastedHTML, PasteCleanup } from '../src/schema/paste'
import {
  blankParagraphs,
  type Classification,
  classifyElement,
  classifyHTML,
  nodeCounts,
  pasteHTML,
} from './paste-harness'

const FIXTURES = join(import.meta.dir, 'fixtures', 'paste')

const SOURCES = {
  'google-docs': [
    'google-docs/android-child-process-priority.html',
    'google-docs/material-design-downloads.html',
    'google-docs/plugin-power-saver.html',
    'google-docs/session-history-oopif.html',
  ],
  word: ['word/mac-m365-notes.html', 'word/win-desktop-review.html'],
  arxiv: ['arxiv/paper-body.html'],
  notion: [
    'notion/app-demo-page-fixture-blok.html',
    'notion/app-page-fixture-pasteinto.html',
    'notion/notion-guide.html',
    'notion/notion-tools-blocks-demo.html',
  ],
  chatgpt: [
    'chatgpt/energy-comparison-math-copy-button.html',
    'chatgpt/energy-comparison-math-selection.html',
    'chatgpt/inline-images-console-code-selection.html',
  ],
  wikipedia: [
    'wikipedia/markdown-variants-to-references.html',
    'wikipedia/pride-and-prejudice-lead-plot-characters.html',
  ],
}
const ALL = Object.values(SOURCES).flat()

// ---------------------------------------------------------------------------
// Pasting a fixture (once per file)

type Pasted = {
  html: string
  /** The fixture as the browser parses it, for expectations derived from the source. */
  doc: Document
  nodes: JSONContent[]
  droppedImages: number
  counts: Record<string, number>
  blank: { top: number; longestRun: number }
  source: Classification
  result: Classification
}

const cache = new Map<string, Pasted>()

function paste(name: string): Pasted {
  const cached = cache.get(name)
  if (cached) return cached
  const html = readFileSync(join(FIXTURES, name), 'utf8')
  const result = pasteHTML(html)
  const pasted: Pasted = {
    html,
    doc: new DOMParser().parseFromString(html, 'text/html'),
    nodes: (result.slice.content.toJSON() as JSONContent[] | null) ?? [],
    droppedImages: result.droppedImages,
    counts: nodeCounts(result.slice.content),
    blank: blankParagraphs(result.slice.content),
    source: classifyHTML(name.startsWith('word/') ? withoutWordChrome(html) : html),
    result: classifyElement(result.dom),
  }
  cache.set(name, pasted)
  return pasted
}

/**
 * Out of Word's source counts: review comments (not document content) and the
 * typed-out list markers that the rebuilt lists render themselves.
 */
function withoutWordChrome(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (const el of doc.querySelectorAll(
    'a.msocomanchor, div[style*="mso-element:comment-list"], span[style*="mso-list:Ignore"]'
  )) {
    el.remove()
  }
  return doc.documentElement.outerHTML
}

/**
 * What the snapshot stores: the pasted JSON and the dropped-image count. Block
 * ids are dropped (they are random, and arrive with the block-id work); footnote
 * ids are random too, so they are numbered in order of appearance, which keeps
 * each reference visibly tied to its note.
 */
function forSnapshot({ nodes, droppedImages }: Pasted) {
  const footnoteIds = new Map<string, string>()
  const attrsOf = (node: JSONContent) => {
    const kept = Object.entries(node.attrs ?? {}).flatMap(([key, value]): [string, unknown][] => {
      if (key !== 'id') return [[key, value]]
      if (node.type !== 'footnote' && node.type !== 'footnoteReference') return []
      if (!footnoteIds.has(String(value))) {
        footnoteIds.set(String(value), `fn-${footnoteIds.size + 1}`)
      }
      return [[key, footnoteIds.get(String(value))]]
    })
    return kept.length > 0 ? Object.fromEntries(kept) : undefined
  }
  const visit = (node: JSONContent): JSONContent => {
    const out: JSONContent = {}
    for (const [key, value] of Object.entries(node)) {
      if (key === 'content') out.content = node.content?.map(visit)
      else if (key !== 'attrs') out[key] = value
      else {
        const attrs = attrsOf(node)
        if (attrs) out.attrs = attrs
      }
    }
    return out
  }
  return compactJSON({ droppedImages, content: nodes.map(visit) })
}

/**
 * JSON with a line per node: leaves (text nodes, marks, attributes) and anything
 * that fits in 100 columns stay on one line, so a change shows up as a small diff.
 */
function compactJSON(value: unknown, indent = ''): string {
  const flat = JSON.stringify(value) ?? 'null'
  if (typeof value !== 'object' || value === null || indent.length + flat.length <= 100) return flat
  if (!Array.isArray(value) && !('content' in value)) return flat
  const inner = `${indent}  `
  const items = Array.isArray(value)
    ? value.map((item) => inner + compactJSON(item, inner))
    : Object.entries(value).map(
        ([key, item]) => `${inner}${JSON.stringify(key)}: ${compactJSON(item, inner)}`
      )
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}']
  return `${open}\n${items.join(',\n')}\n${indent}${close}`
}

// ---------------------------------------------------------------------------
// JSON helpers

function all(nodes: JSONContent[], type: string): JSONContent[] {
  const out: JSONContent[] = []
  const visit = (node: JSONContent) => {
    if (node.type === type) out.push(node)
    node.content?.forEach(visit)
  }
  nodes.forEach(visit)
  return out
}

const textOf = (node: JSONContent | JSONContent[]): string =>
  Array.isArray(node)
    ? node.map(textOf).join('\n')
    : (node.text ?? '') + (node.content ?? []).map(textOf).join('')

const hasMark = (node: JSONContent, type: string) =>
  node.marks?.some((mark) => mark.type === type) ?? false

const markAttr = (node: JSONContent, type: string, attr: string): unknown =>
  node.marks?.find((mark) => mark.type === type)?.attrs?.[attr]

/** Text nodes carrying a mark. */
const marked = (nodes: JSONContent[], type: string) =>
  all(nodes, 'text').filter((node) => hasMark(node, type))

/** An empty line: a paragraph with nothing in it but line breaks and white space. */
const isBlank = (node: JSONContent) =>
  node.type === 'paragraph' &&
  (node.content ?? []).every(
    (child) =>
      child.type === 'hardBreak' ||
      (child.type === 'text' && !/[^\s\u00a0\u200b]/.test(child.text ?? ''))
  )

function listDepth(nodes: JSONContent[], depth = 0): number {
  let max = depth
  for (const node of nodes) {
    const list = /^(bulletList|orderedList|taskList)$/.test(node.type ?? '') ? 1 : 0
    max = Math.max(max, listDepth(node.content ?? [], depth + list))
  }
  return max
}

/** Blue-dominant: the default link colour Docs and Word restate on every link. */
function isLinkBlue(color: string): boolean {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color)
  if (!hex) return /^blue$/i.test(color)
  const [r, g, b] = hex.slice(1).map((part) => Number.parseInt(part, 16)) as [
    number,
    number,
    number,
  ]
  return b >= 150 && b - Math.max(r, g) >= 50
}

/** Footnote references and notes pair up one to one, and the notes come last. */
function expectLinkedFootnotes(nodes: JSONContent[], count: number) {
  const refs = all(nodes, 'footnoteReference').map((node) => node.attrs?.id)
  const notes = all(nodes, 'footnote').map((node) => node.attrs?.id)
  expect(notes).toHaveLength(count)
  expect(new Set(refs)).toEqual(new Set(notes))
  expect(nodes.at(-1)?.type).toBe('footnotes')
  expect(nodes.filter((node) => node.type === 'footnotes')).toHaveLength(1)
}

const count = (doc: Document, selector: string) => doc.querySelectorAll(selector).length

// ---------------------------------------------------------------------------
// Every fixture

test('every fixture on disk is covered here', () => {
  const onDisk = readdirSync(FIXTURES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((dir) =>
      readdirSync(join(FIXTURES, dir.name))
        .filter((file) => file.endsWith('.html'))
        .map((file) => `${dir.name}/${file}`)
    )
  expect(onDisk.sort()).toEqual([...ALL].sort())
})

describe.each(ALL)('%s', (name) => {
  test('corpus targets: text once, no dead links, no blank runs, loadable images', () => {
    const { source, result, nodes, blank } = paste(name)
    const ratio = (metric: 'alnum' | 'code' | 'highlight') =>
      result[metric] / Math.max(1, source[metric])
    expect(ratio('alnum')).toBeGreaterThanOrEqual(0.97)
    expect(ratio('alnum')).toBeLessThanOrEqual(1.03)
    if (source.code > 0) expect(ratio('code')).toBeGreaterThanOrEqual(0.9)
    if (source.highlight > 0) expect(ratio('highlight')).toBeGreaterThanOrEqual(0.9)
    expect(result.tasks).toBeGreaterThanOrEqual(source.tasks)
    expect(result.internalLinks).toBe(0)
    expect(blank.longestRun).toBeLessThanOrEqual(1)
    for (const image of all(nodes, 'image')) {
      expect(image.attrs?.src).toMatch(/^(https?:|data:image\/|\/)/)
    }
  })

  test('math arrives as math, never as its TeX spelled out', () => {
    const { doc, result } = paste(name)
    for (const annotation of doc.querySelectorAll('annotation[encoding="application/x-tex"]')) {
      const tex = annotation.textContent?.trim() ?? ''
      if (tex.length >= 3 && /[\\_^{]/.test(tex)) expect(result.text).not.toContain(tex)
    }
    if (count(doc, 'math, .katex') > 0) expect(result.math).toBeGreaterThan(0)
  })

  test('a real editor paste lands the same blocks and reports the same dropped images', () => {
    const { html, counts, droppedImages } = paste(name)
    const element = document.createElement('div')
    document.body.append(element)
    let reported = 0
    // Not YouTube: its paste rule embeds pasted YouTube links, and happy-dom would
    // then fetch the player iframe (no browser does in an inert clipboard document).
    const editor = new Editor({
      element,
      extensions: [
        ...contentExtensions.filter((extension) => extension.name !== 'youtube'),
        PasteCleanup.configure({ onDroppedImages: (n) => (reported += n) }),
      ],
    })
    try {
      editor.view.pasteHTML(html)
      const inEditor: Record<string, number> = {}
      editor.state.doc.descendants((node) => {
        inEditor[node.type.name] = (inEditor[node.type.name] ?? 0) + 1
        return true
      })
      const blocks = [
        'heading',
        'listItem',
        'taskItem',
        'codeBlock',
        'blockquote',
        'table',
        'image',
        'horizontalRule',
        'inlineMath',
        'blockMath',
        'footnoteReference',
        'footnote',
      ]
      const pick = (from: Record<string, number>) =>
        Object.fromEntries(blocks.map((type) => [type, from[type] ?? 0]))
      expect(pick(inEditor)).toEqual(pick(counts))
      expect(reported).toBe(droppedImages)
    } finally {
      editor.destroy()
      element.remove()
    }
  })

  test('snapshot', () => {
    expect(forSnapshot(paste(name))).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// Google Docs

describe('Google Docs', () => {
  test.each(SOURCES['google-docs'])('%s: the docs-internal-guid wrapper is unwrapped', (name) => {
    const { html } = paste(name)
    expect(html).toContain('docs-internal-guid-')
    expect(normalizePastedHTML(html).html).not.toContain('docs-internal-guid-')
  })

  test.each(SOURCES['google-docs'])('%s: the default link blue is not stored', (name) => {
    const { nodes } = paste(name)
    const linkColours = marked(nodes, 'link')
      .map((node) => markAttr(node, 'textStyle', 'color'))
      .filter((color): color is string => typeof color === 'string')
    expect(linkColours.filter(isLinkBlue)).toEqual([])
    expect(marked(nodes, 'link').length).toBeGreaterThan(0)
  })

  // Lemma's typography spaces paragraphs; the blank lines Docs uses for that go.
  const blankLinesDropped = (name: string) => () => {
    const { nodes } = paste(name)
    expect(nodes.filter(isBlank)).toEqual([])
  }
  test(
    'android-child-process-priority: blank lines are dropped',
    blankLinesDropped('google-docs/android-child-process-priority.html')
  )
  test(
    'session-history-oopif: blank lines are dropped, rules included',
    blankLinesDropped('google-docs/session-history-oopif.html')
  )
  // BUG (paste.ts blockItems): a Docs blank line (<br>) next to an image paragraph is
  // taken for a line break, because collapseEmptyBlocks first lifts the <img> out of
  // its <p> and the <br> then counts an inline neighbour. It pastes as a paragraph
  // holding a lone hard break. Fix: treat <img> as a block neighbour in blockItems.
  test(
    'BUG material-design-downloads: blank lines are dropped, even beside an image',
    blankLinesDropped('google-docs/material-design-downloads.html')
  )
  test(
    'BUG plugin-power-saver: blank lines are dropped, even beside an image',
    blankLinesDropped('google-docs/plugin-power-saver.html')
  )

  test('android-child-process-priority: monospace inside prose stays inline code; the table stays', () => {
    const { nodes, source, result } = paste('google-docs/android-child-process-priority.html')
    expect(all(nodes, 'codeBlock')).toEqual([])
    expect(marked(nodes, 'code').length).toBeGreaterThan(0)
    expect(result.code).toBe(source.code)
    const [table] = all(nodes, 'table')
    expect(all([table!], 'tableRow')).toHaveLength(5)
    expect(all(nodes, 'heading').map((node) => node.attrs?.level)).toEqual([2, 2, 3, 3, 4, 4])
  })

  test('material-design-downloads: each run of monospace paragraphs is one code block, a line per paragraph', () => {
    const { nodes } = paste('google-docs/material-design-downloads.html')
    const lines = all(nodes, 'codeBlock').map((node) => textOf(node).split('\n').length)
    expect(lines).toEqual([3, 3, 2, 2, 1])
    // Nothing set entirely in a monospace font is left behind as a paragraph.
    const allCode = (node: JSONContent) =>
      node.type === 'paragraph' &&
      all([node], 'text').length > 0 &&
      all([node], 'text').every((text) => hasMark(text, 'code') || !text.text?.trim())
    expect(nodes.filter(allCode)).toEqual([])
  })

  test('material-design-downloads: highlights, author colours, data: images and deep lists survive', () => {
    const { nodes, source, result, doc } = paste('google-docs/material-design-downloads.html')
    expect(result.highlight).toBe(source.highlight)
    expect(marked(nodes, 'highlight').every((node) => markAttr(node, 'highlight', 'color'))).toBe(
      true
    )
    expect(
      marked(nodes, 'textStyle').some((node) => markAttr(node, 'textStyle', 'color') === '#4a86e8')
    ).toBe(true)
    const images = all(nodes, 'image')
    expect(images).toHaveLength(count(doc, 'img'))
    expect(images.every((image) => String(image.attrs?.src).startsWith('data:image/png'))).toBe(
      true
    )
    expect(listDepth(nodes)).toBe(4)
    expect(all(nodes, 'table')).toHaveLength(1)
  })

  test('plugin-power-saver: code runs, ordered lists, images in tables and mailto links', () => {
    const { nodes, doc } = paste('google-docs/plugin-power-saver.html')
    expect(all(nodes, 'codeBlock').map((node) => textOf(node).split('\n').length)).toEqual([4, 4])
    expect(all(nodes, 'orderedList').length).toBeGreaterThan(0)
    expect(all(nodes, 'image')).toHaveLength(count(doc, 'img'))
    for (const table of all(nodes, 'table')) expect(all([table], 'image').length).toBe(2)
    const hrefs = marked(nodes, 'link').map((node) => String(markAttr(node, 'link', 'href')))
    expect(hrefs.filter((href) => href.startsWith('mailto:')).length).toBe(
      count(doc, 'a[href^="mailto:"]')
    )
  })

  test('session-history-oopif: rules, strike-through and nested lists survive', () => {
    const { nodes, source, result } = paste('google-docs/session-history-oopif.html')
    expect(all(nodes, 'horizontalRule')).toHaveLength(4)
    expect(result.strike).toBe(source.strike)
    expect(result.strike).toBeGreaterThan(0)
    expect(listDepth(nodes)).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Word (hand-written fixtures; see fixtures/paste/README.md)

describe('Word for Windows', () => {
  const name = 'word/win-desktop-review.html'

  test('the footnote and the endnote become footnote nodes, linked to their references', () => {
    const { nodes } = paste(name)
    expectLinkedFootnotes(nodes, 2)
    expect(all(nodes, 'footnote').map(textOf)).toEqual([
      'Median of five runs on the staging cluster, warm caches excluded.',
      'The load profile is described in the capacity plan.',
    ])
    const body = textOf(nodes.filter((node) => node.type !== 'footnotes'))
    expect(body).not.toContain('Median of five runs')
    expect(body).not.toMatch(/\[(1|i)\]/)
  })

  test('review comments are not pasted as text', () => {
    const { nodes } = paste(name)
    const text = textOf(nodes)
    expect(text).not.toContain('RV1')
    expect(text).not.toContain('release log')
    expect(text).toContain('The migration finished two days ahead of plan, and error rates')
  })

  test('mso-list paragraphs become nested lists, without the typed markers', () => {
    const { nodes } = paste(name)
    const bullets = nodes.find((node) => node.type === 'bulletList')
    const numbers = nodes.find((node) => node.type === 'orderedList')
    expect(bullets?.content?.map(textOf)).toEqual([
      'Search indexing moved to the shared queue.Backfill completed in every region.Query latency is back under 80\u00a0ms at the 95th percentile.',
      'The déjà vu retry bug is fixed; CO2 reporting now uses kWh2-free units.',
    ])
    expect(all([bullets!], 'bulletList')).toHaveLength(2)
    expect(all([numbers!], 'orderedList')).toHaveLength(2)
    expect(numbers?.content).toHaveLength(2)
    expect(textOf(nodes)).not.toMatch(/·|^o\s|\d\.\s{2}/m)
  })

  test('headings stay headings', () => {
    const { nodes } = paste(name)
    expect(all(nodes, 'heading').map((node) => [node.attrs?.level, textOf(node)])).toEqual([
      [1, 'Summary'],
      [2, 'Changes since the last review'],
      [2, 'Service status'],
    ])
  })

  test('highlights, colours, strike, sub- and superscript survive as marks', () => {
    const { nodes } = paste(name)
    const highlight = (text: string) =>
      markAttr(all(nodes, 'text').find((node) => node.text === text) ?? {}, 'highlight', 'color')
    expect(highlight('the certificate rotation runbook')).toBe('yellow')
    expect(highlight('the on-call handover notes')).toBe('lime')
    expect(highlight('Degraded')).toBe('yellow')
    const colour = (text: string) =>
      markAttr(all(nodes, 'text').find((node) => node.text === text) ?? {}, 'textStyle', 'color')
    expect(colour('forty percent')).toBe('#C00000')
    expect(colour('Healthy')).toBe('#00B050')
    expect(marked(nodes, 'strike').map((node) => node.text)).toEqual(['still valid'])
    expect(marked(nodes, 'subscript').map((node) => node.text)).toEqual(['2'])
    expect(marked(nodes, 'superscript').map((node) => node.text)).toEqual(['2'])
  })

  test('white text on a shaded header cell keeps the shading as a highlight', () => {
    const { nodes } = paste(name)
    const [header] = all(nodes, 'tableRow')
    for (const text of all([header!], 'text')) {
      expect(markAttr(text, 'highlight', 'color')).toBe('#4472C4')
      expect(hasMark(text, 'bold')).toBe(true)
    }
  })

  test("the link keeps its href but not Word's hyperlink blue", () => {
    const { nodes } = paste(name)
    const [link] = marked(nodes, 'link')
    expect(link?.text).toBe('status page')
    expect(markAttr(link!, 'link', 'href')).toBe('https://www.example.com/status/autumn-release')
    expect(markAttr(link!, 'textStyle', 'color') ?? null).toBeNull()
  })

  test('the file:// picture is dropped and reported', () => {
    const { nodes, droppedImages } = paste(name)
    expect(droppedImages).toBe(1)
    expect(all(nodes, 'image')).toEqual([])
    expect(JSON.stringify(nodes)).not.toContain('file:')
  })

  test('blank lines: at most one in a row', () => {
    const { nodes } = paste(name)
    const blankAfter = nodes.map(isBlank)
    expect(blankAfter.some((blank, i) => blank && blankAfter[i + 1])).toBe(false)
    expect(blankAfter[0]).toBe(false)
  })

  // BUG (paste.ts collapseEmptyBlocks): the blank line a run of Word's
  // <p><o:p>&nbsp;</o:p></p> collapses to keeps its no-break space, so it pastes
  // as a paragraph holding " ", not an empty paragraph. Fix: replace a kept empty
  // <p> with a fresh one, as is already done for a <br> blank line.
  test('BUG: a kept blank line is an empty paragraph', () => {
    const { nodes } = paste(name)
    for (const node of nodes.filter(isBlank)) expect(node.content ?? []).toEqual([])
  })

  // BUG (paste.ts): Word writes a manual page break as
  // <span><br clear=all style='mso-special-character:line-break;page-break-before:always'></span>
  // between paragraphs. The span hides the <br> from the blank-line rule, so it
  // pastes as a paragraph holding a lone hard break. Fix: drop <br>s styled
  // page-break-before (or count an inline wrapper holding only <br>s as a blank line).
  test('BUG: a manual page break leaves no hard-break paragraph behind', () => {
    const { nodes } = paste(name)
    const lone = nodes.filter(
      (node) => node.type === 'paragraph' && node.content?.every((c) => c.type === 'hardBreak')
    )
    expect(lone).toEqual([])
  })
})

describe('Word for Mac (Microsoft 365)', () => {
  const name = 'word/mac-m365-notes.html'

  test('bullets nest and numbering continues from 3', () => {
    const { nodes } = paste(name)
    expect(nodes.map((node) => node.type)).toEqual([
      'heading',
      'paragraph',
      'bulletList',
      'paragraph',
      'orderedList',
      'table',
    ])
    const [bullets, , numbers] = nodes.filter((node) => /List$/.test(node.type ?? ''))
    expect(listDepth([bullets!])).toBe(2)
    expect(nodes.find((node) => node.type === 'orderedList')?.attrs?.start).toBe(3)
    expect(numbers).toBeUndefined()
    expect(textOf(nodes)).not.toMatch(/·|\b[34]\./)
  })

  test('mso-highlight becomes a highlight, with or without a background restated', () => {
    const { nodes } = paste(name)
    expect(
      marked(nodes, 'highlight').map((node) => [node.text, markAttr(node, 'highlight', 'color')])
    ).toEqual([
      ['Repair the greenhouse door', 'yellow'],
      ['forty', 'cyan'],
    ])
  })

  test('the file:////Users/… picture is dropped and reported', () => {
    const { nodes, droppedImages } = paste(name)
    expect(droppedImages).toBe(1)
    expect(all(nodes, 'image')).toEqual([])
  })

  test('the table keeps its bold header row', () => {
    const { nodes } = paste(name)
    const [header] = all(nodes, 'tableRow')
    expect(all([header!], 'text').map((node) => [node.text, hasMark(node, 'bold')])).toEqual([
      ['Task', true],
      ['Volunteer', true],
    ])
  })
})

// ---------------------------------------------------------------------------
// LaTeXML (arXiv HTML)

describe('LaTeXML (arXiv)', () => {
  const name = 'arxiv/paper-body.html'
  const equations = 'table.ltx_equation, table.ltx_equationgroup'

  test('inline formulas become inlineMath; each equation table one blockMath', () => {
    const { nodes, doc } = paste(name)
    const inline = Array.from(doc.querySelectorAll('math')).filter((m) => !m.closest(equations))
    expect(all(nodes, 'inlineMath')).toHaveLength(inline.length)
    expect(all(nodes, 'blockMath')).toHaveLength(count(doc, equations))
    expect(all(nodes, 'inlineMath').every((node) => node.attrs?.latex)).toBe(true)
  })

  test('an aligned equation group becomes one aligned block', () => {
    const { nodes } = paste(name)
    const aligned = all(nodes, 'blockMath').filter((node) =>
      String(node.attrs?.latex).startsWith('\\begin{aligned}')
    )
    expect(aligned).toHaveLength(1)
    expect(String(aligned[0]?.attrs?.latex)).toContain(' & ')
  })

  test('author thanks and footnotes become footnote nodes; a bare \\footnotemark stays superscript', () => {
    const { nodes, doc } = paste(name)
    const withText = Array.from(doc.querySelectorAll('.ltx_note_content')).filter((content) => {
      const copy = content.cloneNode(true) as Element
      for (const junk of copy.querySelectorAll('.ltx_note_mark, .ltx_note_type, .ltx_tag_note'))
        junk.remove()
      return copy.textContent?.trim()
    })
    expectLinkedFootnotes(nodes, withText.length)
    expect(count(doc, '.ltx_role_thanks')).toBe(3)
    expect(marked(nodes, 'superscript')).toHaveLength(count(doc, '.ltx_role_footnotemark'))
    // The note math moves with the note.
    expect(all(all(nodes, 'footnotes'), 'inlineMath').length).toBeGreaterThan(0)
  })

  test("notes leave the body, and LaTeXML's labels go", () => {
    const { nodes, doc } = paste(name)
    const body = textOf(nodes.filter((node) => node.type !== 'footnotes'))
    for (const note of doc.querySelectorAll('.ltx_role_footnote .ltx_note_content')) {
      const text = note.textContent?.replace(/\s+/g, ' ').trim().slice(-30) ?? ''
      expect(body).not.toContain(text)
    }
    expect(textOf(nodes)).not.toMatch(/thanks:|footnote:|footnotemark:/)
  })

  test('citations keep their text, in order, without links into the bibliography', () => {
    const { nodes, doc, result } = paste(name)
    const hrefs = marked(nodes, 'link').map((node) => String(markAttr(node, 'link', 'href')))
    expect(hrefs.filter((href) => href.includes('#'))).toEqual([])
    const flat = result.text.replace(/\s+/g, ' ')
    let at = 0
    for (const cite of doc.querySelectorAll('cite.ltx_cite')) {
      const text = cite.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      const found = flat.indexOf(text, at)
      expect(found).toBeGreaterThanOrEqual(0)
      at = found + text.length
    }
  })

  test('figures keep their https images', () => {
    const { nodes, doc } = paste(name)
    const images = all(nodes, 'image')
    expect(images).toHaveLength(count(doc, 'figure img'))
    expect(images.every((image) => String(image.attrs?.src).startsWith('https://'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Notion

describe('Notion, public page', () => {
  test('notion-tools-blocks-demo: the to-do block becomes a task item', () => {
    const { nodes, doc } = paste('notion/notion-tools-blocks-demo.html')
    const items = all(nodes, 'taskItem')
    expect(items).toHaveLength(count(doc, '.notion-to_do-block'))
    expect(items.map((item) => item.attrs?.checked)).toEqual(
      Array.from(doc.querySelectorAll('.notion-to_do-block input'), (box) =>
        box.hasAttribute('checked')
      )
    )
    expect(all(nodes, 'taskList')).toHaveLength(1)
  })

  test('notion-tools-blocks-demo: headings, image, quote and table come through', () => {
    const { nodes } = paste('notion/notion-tools-blocks-demo.html')
    expect(all(nodes, 'heading').map((node) => node.attrs?.level)).toEqual([2, 3, 4])
    expect(all(nodes, 'image').map((node) => String(node.attrs?.src).slice(0, 8))).toEqual([
      'https://',
    ])
    expect(all(nodes, 'blockquote')).toHaveLength(1)
    expect(all(nodes, 'tableRow')).toHaveLength(2)
  })

  test('notion-guide: inline code stays inside its paragraph', () => {
    const { nodes, source, result } = paste('notion/notion-guide.html')
    expect(result.code).toBe(source.code)
    const withCode = all(nodes, 'paragraph').filter((p) => marked([p], 'code').length > 0)
    expect(withCode.length).toBeGreaterThan(0)
    for (const paragraph of withCode) {
      expect(all([paragraph], 'text').some((text) => !hasMark(text, 'code'))).toBe(true)
    }
    expect(all(nodes, 'codeBlock')).toEqual([])
  })
})

describe('Notion, app clipboard', () => {
  test('app-demo-page-fixture-blok: "[ ]" / "[x]" items become task items; mixed lists split', () => {
    const { nodes, doc } = paste('notion/app-demo-page-fixture-blok.html')
    const boxes = Array.from(doc.querySelectorAll('li'))
      .map((li) => /^\s*\[([ xX])\]/.exec(li.textContent ?? '')?.[1])
      .filter((mark): mark is string => mark !== undefined)
    expect(all(nodes, 'taskItem').map((item) => item.attrs?.checked)).toEqual(
      boxes.map((mark) => mark !== ' ')
    )
    for (const item of all(nodes, 'taskItem')) expect(textOf(item)).not.toMatch(/^\s*\[[ xX]\]/)
  })

  test('app-demo-page-fixture-blok: attachment: images are dropped and reported', () => {
    const { nodes, droppedImages, doc } = paste('notion/app-demo-page-fixture-blok.html')
    expect(droppedImages).toBe(count(doc, 'img[src^="attachment:"]'))
    expect(all(nodes, 'image').map((node) => String(node.attrs?.src).slice(0, 8))).toEqual([
      'https://',
    ])
  })

  test('app-demo-page-fixture-blok: code blocks keep their language; tables, rules and quotes stay', () => {
    const { nodes, doc } = paste('notion/app-demo-page-fixture-blok.html')
    const languages = Array.from(
      doc.querySelectorAll('pre > code'),
      (code) => /language-(\S+)/.exec(code.className)?.[1] ?? null
    )
    expect(all(nodes, 'codeBlock').map((node) => node.attrs?.language)).toEqual(languages)
    expect(all(nodes, 'table')).toHaveLength(count(doc, 'table'))
    expect(all(nodes, 'horizontalRule')).toHaveLength(count(doc, 'hr'))
    expect(all(nodes, 'blockquote')).toHaveLength(count(doc, 'blockquote'))
  })

  test('app-page-fixture-pasteinto: checked and unchecked to-dos, a code block, inline code', () => {
    const { nodes } = paste('notion/app-page-fixture-pasteinto.html')
    expect(nodes.map((node) => node.type)).toEqual([
      'heading',
      'paragraph',
      'bulletList',
      'orderedList',
      'taskList',
      'blockquote',
      'codeBlock',
      'paragraph',
    ])
    expect(all(nodes, 'taskItem').map((item) => item.attrs?.checked)).toEqual([true, false])
    expect(all(nodes, 'codeBlock')[0]?.attrs?.language).toBe('jsx')
    expect(marked(nodes, 'code')).toHaveLength(1)
    expect(listDepth(nodes)).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// ChatGPT

describe('ChatGPT', () => {
  test('energy-comparison-math-copy-button: MathML display equations become blockMath with their TeX', () => {
    const { nodes, doc } = paste('chatgpt/energy-comparison-math-copy-button.html')
    const tex = Array.from(doc.querySelectorAll('math[display="block"] annotation'), (annotation) =>
      annotation.textContent?.trim()
    )
    expect(tex).toHaveLength(2)
    expect(all(nodes, 'blockMath').map((node) => node.attrs?.latex)).toEqual(tex)
    expect(all(nodes, 'heading')).toHaveLength(count(doc, 'h3'))
    expect(all(nodes, 'blockquote')).toHaveLength(1)
    expect(listDepth(nodes)).toBe(2)
  })

  test('energy-comparison-math-selection: KaTeX display equations become blockMath; favicons stay https images', () => {
    const { nodes, doc } = paste('chatgpt/energy-comparison-math-selection.html')
    // KaTeX without a .katex-display wrapper: display mode is only on the MathML.
    expect(count(doc, '.katex')).toBe(2)
    const tex = Array.from(
      doc.querySelectorAll('.katex math[display="block"] annotation'),
      (annotation) => annotation.textContent?.trim()
    )
    expect(tex).toHaveLength(2)
    expect(all(nodes, 'blockMath').map((node) => node.attrs?.latex)).toEqual(tex)
    expect(all(nodes, 'inlineMath')).toEqual([])
    const images = all(nodes, 'image')
    expect(images).toHaveLength(count(doc, 'img'))
    expect(images.every((image) => String(image.attrs?.src).startsWith('https://'))).toBe(true)
  })

  test('inline-images-console-code-selection: inline code stays inline; list numbering is kept', () => {
    const { nodes, doc } = paste('chatgpt/inline-images-console-code-selection.html')
    expect(marked(nodes, 'code')).toHaveLength(
      Array.from(doc.querySelectorAll('code')).filter((code) => !code.closest('pre')).length
    )
    expect(all(nodes, 'orderedList').map((node) => node.attrs?.start)).toEqual(
      Array.from(doc.querySelectorAll('ol'), (ol) => Number(ol.getAttribute('start') ?? 1))
    )
  })

  // BUG (paste.ts): ChatGPT renders a code block as its own UI <pre> (header, copy
  // button) around a CodeMirror <pre class="cm-content"><code>. The nested <pre>
  // pastes as an empty code block followed by the code; worse, the outer <pre>'s
  // `white-space: pre` parse leaks into every block after it, so their source
  // newlines become hard breaks (19 here, against one <br> in the source). Fix: in
  // normalizePastedHTML, replace a <pre> that holds another <pre> with the inner one.
  test('BUG inline-images-console-code-selection: one code block per ChatGPT code block', () => {
    const { nodes, doc } = paste('chatgpt/inline-images-console-code-selection.html')
    const blocks = all(nodes, 'codeBlock')
    expect(blocks).toHaveLength(count(doc, 'pre pre'))
    expect(blocks.filter((block) => !textOf(block))).toEqual([])
  })
  test('BUG inline-images-console-code-selection: hard breaks only where the source has <br>', () => {
    const { counts, doc } = paste('chatgpt/inline-images-console-code-selection.html')
    expect(counts.hardBreak ?? 0).toBe(count(doc, 'br'))
  })
})

// ---------------------------------------------------------------------------
// Wikipedia

describe('Wikipedia', () => {
  test('markdown-variants-to-references: <pre> samples become code blocks; the examples table keeps its header', () => {
    const { nodes, doc } = paste('wikipedia/markdown-variants-to-references.html')
    expect(all(nodes, 'codeBlock')).toHaveLength(count(doc, 'pre'))
    expect(all(nodes, 'codeBlock').every((block) => textOf(block).includes('\n'))).toBe(true)
    expect(all(nodes, 'tableHeader')).toHaveLength(count(doc, 'th'))
    expect(all(nodes, 'image')).toHaveLength(1)
    expect(all(nodes, 'horizontalRule')).toHaveLength(1)
  })

  test.each(
    SOURCES.wikipedia
  )('%s: reference markers stay superscript links to the article', (name) => {
    const { nodes, doc } = paste(name)
    const markers = marked(nodes, 'superscript').filter((node) => hasMark(node, 'link'))
    expect(markers).toHaveLength(count(doc, 'sup.reference'))
    for (const marker of markers) {
      expect(String(markAttr(marker, 'link', 'href'))).toMatch(/^https:\/\/.*#cite_note-/)
    }
  })

  test('pride-and-prejudice-lead-plot-characters: the infobox, figures and character lists come through', () => {
    const { nodes, doc } = paste('wikipedia/pride-and-prejudice-lead-plot-characters.html')
    expect(all(nodes, 'image')).toHaveLength(count(doc, 'img'))
    expect(all(nodes, 'table')).toHaveLength(count(doc, 'table'))
    expect(all(nodes, 'listItem')).toHaveLength(count(doc, 'li'))
    expect(marked(nodes, 'bold').length).toBeGreaterThan(0)
    expect(marked(nodes, 'italic').length).toBeGreaterThan(0)
  })
})
