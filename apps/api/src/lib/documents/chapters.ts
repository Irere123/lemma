import type { JSONContent } from '@lemma/content/schema'

import { searchPattern, type TextSearch } from './text-search'

// Chapter surgery for Books: split a chapter at a block, merge two, move
// blocks between them. Pure functions over document JSON; footnotes follow
// the text that references them.

type Doc = JSONContent

const EMPTY: Doc[] = [{ type: 'paragraph' }]

function footnoteRefs(nodes: Doc[]): Set<string> {
  const ids = new Set<string>()
  const walk = (node: Doc) => {
    if (node.type === 'footnoteReference' && typeof node.attrs?.id === 'string')
      ids.add(node.attrs.id)
    node.content?.forEach(walk)
  }
  nodes.forEach(walk)
  return ids
}

/** Body blocks and the footnote bodies, apart. */
function parts(doc: Doc): { blocks: Doc[]; notes: Doc[] } {
  const content = doc.content ?? []
  const list = content.find((node) => node.type === 'footnotes')
  return { blocks: content.filter((node) => node.type !== 'footnotes'), notes: list?.content ?? [] }
}

/** A document from blocks, with exactly the notes they reference. */
function assemble(blocks: Doc[], notes: Doc[]): Doc {
  const body = blocks.length > 0 ? blocks : EMPTY
  const refs = footnoteRefs(body)
  const kept = notes.filter((note) => refs.has(String(note.attrs?.id ?? '')))
  return {
    type: 'doc',
    content: kept.length > 0 ? [...body, { type: 'footnotes', content: kept }] : body,
  }
}

function containsId(node: Doc, id: string): boolean {
  if (node.attrs?.id === id) return true
  return (node.content ?? []).some((child) => containsId(child, id))
}

/** Index of the top-level block that is, or contains, the block `id`. */
export function topLevelIndex(doc: Doc, id: string): number {
  return parts(doc).blocks.findIndex((block) => containsId(block, id))
}

/**
 * Split before the top-level block containing `blockId`. Returns null when
 * that would leave either side empty (splitting at the very start).
 */
export function splitContent(doc: Doc, blockId: string): { first: Doc; second: Doc } | null {
  const { blocks, notes } = parts(doc)
  const index = topLevelIndex(doc, blockId)
  if (index <= 0) return null
  return {
    first: assemble(blocks.slice(0, index), notes),
    second: assemble(blocks.slice(index), notes),
  }
}

const plainText = (node: Doc): string =>
  typeof node.text === 'string' ? node.text : (node.content ?? []).map(plainText).join('')

/** A title for the second half of a split: its opening heading, if it has one. */
export function splitTitle(second: Doc): string | null {
  const first = second.content?.[0]
  return first?.type === 'heading' ? plainText(first).trim() || null : null
}

/**
 * `second` appended to `first`, under a heading with second's title unless
 * it already opens with a heading.
 */
export function mergeContent(first: Doc, second: Doc, secondTitle: string | null): Doc {
  const a = parts(first)
  const b = parts(second)
  const opensWithHeading = b.blocks[0]?.type === 'heading'
  const heading: Doc[] =
    secondTitle && !opensWithHeading
      ? [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: secondTitle }] }]
      : []
  const nonEmpty = (blocks: Doc[]) =>
    blocks.filter((block) => !(block.type === 'paragraph' && !block.content?.length))
  return assemble(
    [...nonEmpty(a.blocks), ...heading, ...nonEmpty(b.blocks)],
    [...a.notes, ...b.notes]
  )
}

/**
 * Take the top-level blocks containing `blockIds` out of `from` and add them
 * to the start or end of `to`, notes included.
 */
export function moveBlocks(
  from: Doc,
  to: Doc,
  blockIds: string[],
  where: 'start' | 'end'
): { from: Doc; to: Doc; moved: number } {
  const source = parts(from)
  const target = parts(to)
  const picked = source.blocks.filter((block) => blockIds.some((id) => containsId(block, id)))
  if (picked.length === 0) return { from, to, moved: 0 }
  const rest = source.blocks.filter((block) => !picked.includes(block))
  const targetBlocks = target.blocks.filter(
    (block) => !(block.type === 'paragraph' && !block.content?.length)
  )
  return {
    from: assemble(rest, source.notes),
    to: assemble(where === 'start' ? [...picked, ...targetBlocks] : [...targetBlocks, ...picked], [
      ...target.notes,
      ...source.notes,
    ]),
    moved: picked.length,
  }
}

export type TextMatch = { blockId: string | null; before: string; match: string; after: string }

/**
 * Where `search` matches in a chapter's title, subtitle and prose (code
 * blocks are skipped, as the replace skips them), with some context.
 */
export function findMatches(
  fields: { title: string; subtitle: string; content: Doc },
  search: TextSearch,
  limit = 20
): { count: number; matches: TextMatch[] } {
  const pattern = searchPattern(search)
  if (!pattern) return { count: 0, matches: [] }
  let count = 0
  const matches: TextMatch[] = []
  const scan = (text: string, blockId: string | null) => {
    for (const found of text.matchAll(pattern)) {
      count++
      if (matches.length >= limit) continue
      const index = found.index ?? 0
      matches.push({
        blockId,
        before: text.slice(Math.max(0, index - 40), index),
        match: found[0],
        after: text.slice(index + found[0].length, index + found[0].length + 40),
      })
    }
  }
  scan(fields.title, null)
  scan(fields.subtitle, null)
  const walk = (node: Doc, blockId: string | null) => {
    if (node.type === 'codeBlock') return
    const id = typeof node.attrs?.id === 'string' ? node.attrs.id : blockId
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'figcaption') {
      // Each run of text between inline nodes is matched on its own, like the replace.
      let run = ''
      for (const child of node.content ?? []) {
        if (child.type === 'text') run += child.text ?? ''
        else {
          scan(run, id)
          run = ''
        }
      }
      scan(run, id)
      return
    }
    for (const child of node.content ?? []) walk(child, id)
  }
  walk(fields.content, null)
  return { count, matches }
}
