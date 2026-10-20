import type { JSONContent } from '@tiptap/core'

import { safeCssColor, sanitizeUrl } from '../sanitize'
import { BLOCK_ID_PATTERN, isBlockIdType } from './block-ids'
import { getContentSchema } from './index'
import { UNMARKED_INLINE_TYPES } from './unmarked'

export class ContentValidationError extends Error {
  constructor(
    message: string,
    readonly problems: string[]
  ) {
    super(message)
    this.name = 'ContentValidationError'
  }
}

export type ValidateOptions = {
  /**
   * strict (API writes): reject unknown node/mark types with a clear error.
   * lenient (legacy migration, paste): unwrap unknown nodes, drop unknown marks.
   */
  strict?: boolean
}

const MAX_DEPTH = 64

type Mark = NonNullable<JSONContent['marks']>[number]

/**
 * Bring stored or submitted JSON up to the current model before it touches the
 * schema: rename legacy node types, strip presentational attributes and
 * neutralise anything that would be unsafe to render.
 */
export function normalizeContent(input: unknown, options: ValidateOptions = {}): JSONContent {
  const schema = getContentSchema()
  const problems: string[] = []
  const strict = options.strict ?? false

  const normalizeMarks = (marks: unknown): Mark[] | undefined => {
    if (!Array.isArray(marks)) return undefined
    const out: Mark[] = []
    for (const raw of marks) {
      if (!raw || typeof raw !== 'object') continue
      const mark = { ...(raw as Mark) }
      const attrs = { ...(mark.attrs ?? {}) } as Record<string, unknown>

      if (mark.type === 'strong') mark.type = 'bold'
      if (mark.type === 'em') mark.type = 'italic'
      if (mark.type === 'strikethrough') mark.type = 'strike'

      if (!schema.marks[mark.type]) {
        problems.push(`unknown mark "${mark.type}"`)
        continue
      }

      if (mark.type === 'link') {
        const href = sanitizeUrl(attrs.href)
        if (!href) continue
        attrs.href = href
        attrs.class = null
        if (attrs.title === '') attrs.title = null
      }
      if (mark.type === 'textStyle' || mark.type === 'highlight') {
        if ('color' in attrs) attrs.color = safeCssColor(attrs.color)
        // A bare textStyle carries nothing once its colour is gone.
        if (mark.type === 'textStyle' && !attrs.color) continue
      }

      out.push(Object.keys(attrs).length > 0 ? { ...mark, attrs } : { type: mark.type })
    }
    return resolveExclusions(out)
  }

  // Marks that can't coexist (e.g. `code` excludes every other mark, and a
  // mark excludes a second copy of itself): code wins, otherwise first wins.
  const resolveExclusions = (marks: Mark[]): Mark[] | undefined => {
    const kept: Mark[] = []
    for (const mark of marks) {
      const type = schema.marks[mark.type]
      if (!type) continue
      const clash = kept.some((other) => {
        const otherType = schema.marks[other.type]
        return otherType ? otherType.excludes(type) || type.excludes(otherType) : false
      })
      if (!clash) kept.push(mark)
      else if (mark.type === 'code') kept.splice(0, kept.length, mark)
    }
    return kept.length > 0 ? kept : undefined
  }

  const normalizeNode = (raw: unknown, depth: number): JSONContent[] => {
    if (!raw || typeof raw !== 'object') return []
    if (depth > MAX_DEPTH) {
      problems.push('document nests too deeply')
      return []
    }

    const node = { ...(raw as JSONContent) }
    const attrs = { ...(node.attrs ?? {}) } as Record<string, unknown>

    // Legacy single math node (Novel) → inline math.
    if (node.type === 'math') node.type = 'inlineMath'

    const children = Array.isArray(node.content)
      ? node.content.flatMap((child) => normalizeNode(child, depth + 1))
      : undefined

    if (node.type === 'text') {
      if (typeof node.text !== 'string' || node.text.length === 0) return []
      const marks = normalizeMarks(node.marks)
      return [marks ? { type: 'text', text: node.text, marks } : { type: 'text', text: node.text }]
    }

    if (!node.type || !schema.nodes[node.type]) {
      problems.push(`unknown node "${node.type ?? '(missing type)'}"`)
      return children ?? []
    }

    if (node.type === 'heading') {
      const level = Number(attrs.level)
      attrs.level = Number.isFinite(level) ? Math.min(6, Math.max(1, Math.round(level))) : 1
    }
    if (node.type === 'image') {
      const src = sanitizeUrl(attrs.src, { allowData: true })
      if (!src) return []
      attrs.src = src
      // Text attributes are strings, and an empty one is no value.
      for (const key of ['alt', 'title'] as const) {
        if (attrs[key] === '' || attrs[key] === undefined) attrs[key] = null
        else if (attrs[key] !== null) attrs[key] = String(attrs[key])
      }
    }
    if (node.type === 'codeBlock') {
      const language = typeof attrs.language === 'string' ? attrs.language.trim() : null
      attrs.language = language || null
    }
    if (node.type === 'youtube' && !sanitizeUrl(attrs.src)) return []
    // Block ids are identity, not content: keep only well-formed ones.
    if (isBlockIdType(node.type) && 'id' in attrs) {
      if (typeof attrs.id !== 'string' || !BLOCK_ID_PATTERN.test(attrs.id)) attrs.id = null
    }
    if (node.type === 'orderedList') {
      const start = Number(attrs.start ?? 1)
      attrs.start = Number.isFinite(start) ? Math.max(0, Math.round(start)) : 1
    }

    const out: JSONContent = { type: node.type }
    if (Object.keys(attrs).length > 0) out.attrs = attrs
    if (children) out.content = children
    // Equations, footnote references and line breaks never carry marks.
    const marks = UNMARKED_INLINE_TYPES.has(node.type) ? undefined : normalizeMarks(node.marks)
    if (marks) out.marks = marks
    return [out]
  }

  const [doc] = normalizeNode(input, 0)
  if (strict && problems.length > 0) {
    throw new ContentValidationError(`Invalid document: ${problems[0]}`, problems)
  }
  if (!doc || doc.type !== 'doc') {
    if (strict) throw new ContentValidationError('Invalid document: root must be "doc"', problems)
    return { type: 'doc', content: [{ type: 'paragraph' }] }
  }
  if (!doc.content || doc.content.length === 0) doc.content = [{ type: 'paragraph' }]
  return doc
}

/**
 * Normalise, then let ProseMirror itself judge structure: `nodeFromJSON`
 * rejects unknown types and `check()` rejects content that breaks the schema
 * (e.g. a list item outside a list). Returns the canonical JSON.
 */
/**
 * ProseMirror builds attrs as null-prototype objects; structured clone (e.g.
 * Durable Object RPC) rejects those, so hand back ordinary JSON.
 */
export const toPlainJSON = (node: { toJSON(): unknown }): JSONContent =>
  JSON.parse(JSON.stringify(node.toJSON())) as JSONContent

export function validateContent(input: unknown, options: ValidateOptions = {}): JSONContent {
  const schema = getContentSchema()
  const doc = normalizeContent(input, options)
  try {
    const node = schema.nodeFromJSON(doc)
    node.check()
    return toPlainJSON(node)
  } catch (error) {
    if (options.strict) {
      const message = error instanceof Error ? error.message : String(error)
      throw new ContentValidationError(`Invalid document: ${message}`, [message])
    }
    // Lenient: keep the text, drop the structure ProseMirror can't place.
    const node = schema.nodeFromJSON(repairByParagraphs(doc))
    node.check()
    return toPlainJSON(node)
  }
}

// Last-resort repair: flatten every top-level block into paragraphs of its text.
function repairByParagraphs(doc: JSONContent): JSONContent {
  const textOf = (node: JSONContent): string =>
    typeof node.text === 'string' ? node.text : (node.content ?? []).map(textOf).join(' ')
  const content = (doc.content ?? [])
    .map((block) => textOf(block).trim())
    .filter(Boolean)
    .map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] }))
  return { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph' }] }
}
