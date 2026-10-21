import type { JSONContent } from '@tiptap/core'
import UniqueID from '@tiptap/extension-unique-id'
import * as Y from 'yjs'

import { BLOCK_ID_PATTERN } from '../ids'

/**
 * Every block a writer could point at carries a stable `id`: links to a
 * paragraph, cross-references, backlinks, comments and revision diffs all
 * anchor on it, and it survives edits, moves (drag keeps it) and syncing.
 * Pasted or duplicated blocks get fresh ids.
 *
 * Footnotes are not listed: they already carry their own `id`.
 */
export const BLOCK_ID_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'image',
  'youtube',
  'table',
  'blockMath',
  'callout',
  'listItem',
  'taskItem',
  'figure',
  'bibliography',
] as const

const BLOCK_ID_TYPE_SET: ReadonlySet<string> = new Set(BLOCK_ID_TYPES)

export { BLOCK_ID_PATTERN }

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** 10 characters, starting with a letter so it's also a valid HTML id / CSS selector. */
export function newBlockId(): string {
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  let id = ALPHABET[(bytes[0] as number) % 26] as string
  for (let i = 1; i < bytes.length; i++) id += ALPHABET[(bytes[i] as number) % 36]
  return id
}

export const isBlockIdType = (type: string | undefined): boolean =>
  type !== undefined && BLOCK_ID_TYPE_SET.has(type)

/**
 * The schema half (the `id` attribute) and, in the editor, the plugin that
 * assigns ids to new blocks. Remote (Yjs) transactions are skipped by the
 * extension itself; the server assigns ids to documents it migrates.
 */
export const BlockIds = UniqueID.configure({
  types: [...BLOCK_ID_TYPES],
  generateID: () => newBlockId(),
})

/**
 * Give every block in a Yjs body an id, and re-id duplicates (keeping the
 * first). Works on the Y types directly so it only touches blocks that need
 * it. Returns how many blocks changed. Call inside a transaction.
 */
export function ensureYBlockIds(fragment: Y.XmlFragment): number {
  const seen = new Set<string>()
  let changed = 0
  const visit = (parent: Y.XmlFragment | Y.XmlElement) => {
    for (const child of parent.toArray()) {
      if (!(child instanceof Y.XmlElement)) continue
      if (isBlockIdType(child.nodeName)) {
        const id = child.getAttribute('id')
        if (typeof id !== 'string' || !BLOCK_ID_PATTERN.test(id) || seen.has(id)) {
          const next = newBlockId()
          child.setAttribute('id', next)
          seen.add(next)
          changed++
        } else {
          seen.add(id)
        }
      }
      visit(child)
    }
  }
  visit(fragment)
  return changed
}

/**
 * Carry block ids from the current body onto an incoming full-document write
 * (the REST/GraphQL API, or an old client that still saves whole documents),
 * so blocks that didn't change keep their identity instead of being re-id'd.
 *
 * Incoming blocks that already have a valid id keep it. Otherwise a block
 * takes the id of an unused current block with identical content, matched in
 * order; anything left gets a new id.
 */
export function carryBlockIds(incoming: JSONContent, current: JSONContent): JSONContent {
  const available = new Map<string, string[]>()
  const used = new Set<string>()

  const collectIncoming = (node: JSONContent) => {
    const id = node.attrs?.id
    if (isBlockIdType(node.type) && typeof id === 'string' && BLOCK_ID_PATTERN.test(id))
      used.add(id)
    for (const child of node.content ?? []) collectIncoming(child)
  }
  collectIncoming(incoming)

  const collectCurrent = (node: JSONContent) => {
    const id = node.attrs?.id
    if (isBlockIdType(node.type) && typeof id === 'string' && !used.has(id)) {
      const key = signature(node)
      const ids = available.get(key)
      if (ids) ids.push(id)
      else available.set(key, [id])
    }
    for (const child of node.content ?? []) collectCurrent(child)
  }
  collectCurrent(current)

  const seen = new Set<string>()
  const assign = (node: JSONContent): JSONContent => {
    const content = node.content?.map(assign)
    if (!isBlockIdType(node.type)) return content ? { ...node, content } : node
    let id = node.attrs?.id
    if (typeof id !== 'string' || !BLOCK_ID_PATTERN.test(id) || seen.has(id)) {
      id = available.get(signature(node))?.shift() ?? newBlockId()
    }
    seen.add(id as string)
    const out: JSONContent = { ...node, attrs: { ...node.attrs, id } }
    if (content) out.content = content
    return out
  }
  return assign(incoming)
}

/** Remove block ids (comparisons, copies that must not share identity). */
export function stripBlockIds(node: JSONContent): JSONContent {
  const { attrs, content, ...rest } = node
  const out: JSONContent = { ...rest }
  if (attrs) {
    const { id: _id, ...others } = attrs
    const kept = isBlockIdType(node.type) ? others : attrs
    if (Object.keys(kept).length > 0) out.attrs = kept
  }
  if (content) out.content = content.map(stripBlockIds)
  return out
}

// A block's content without any ids, as a lookup key.
function signature(node: JSONContent): string {
  return JSON.stringify(stripBlockIds(node))
}

export type BlockChanges = {
  /** In `to` but not in `from`. */
  added: string[]
  /** In `from` but not in `to`. */
  removed: string[]
  /** In both, with different content. */
  changed: string[]
}

/**
 * What changed between two versions of a document, block by block, matched
 * on block ids. Only innermost blocks count (a paragraph in a list item, not
 * the item and the paragraph), so a one-word edit is one change.
 */
export function blockChanges(from: JSONContent, to: JSONContent): BlockChanges {
  const leaves = (root: JSONContent) => {
    const out = new Map<string, string>()
    const visit = (node: JSONContent): boolean => {
      let hasBlockInside = false
      for (const child of node.content ?? []) hasBlockInside = visit(child) || hasBlockInside
      const id = node.attrs?.id
      if (!isBlockIdType(node.type) || typeof id !== 'string') return hasBlockInside
      if (!hasBlockInside) out.set(id, signature(node))
      return true
    }
    visit(root)
    return out
  }
  const before = leaves(from)
  const after = leaves(to)
  const changes: BlockChanges = { added: [], removed: [], changed: [] }
  for (const [id, content] of after) {
    const previous = before.get(id)
    if (previous === undefined) changes.added.push(id)
    else if (previous !== content) changes.changed.push(id)
  }
  for (const id of before.keys()) if (!after.has(id)) changes.removed.push(id)
  return changes
}
