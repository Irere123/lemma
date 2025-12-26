import type { JSONContent } from '@tiptap/core'

/**
 * Migrates content from various formats to Tiptap JSON format
 */

// Slate node type detection
interface SlateNode {
  type?: string
  text?: string
  children?: SlateNode[]
  [key: string]: any
}

// ProseMirror node type detection
interface ProseMirrorNode {
  type: string
  content?: ProseMirrorNode[]
  text?: string
  attrs?: Record<string, any>
  marks?: { type: string; attrs?: Record<string, any> }[]
}

/**
 * Check if content is Slate format (array of nodes)
 */
export function isSlateContent(content: unknown): content is SlateNode[] {
  return Array.isArray(content) && content.length > 0 && 'children' in (content[0] || {})
}

/**
 * Check if content is ProseMirror/Tiptap format
 */
export function isProseMirrorContent(content: unknown): content is ProseMirrorNode {
  return (
    typeof content === 'object' &&
    content !== null &&
    'type' in content &&
    (content as any).type === 'doc'
  )
}

/**
 * Check if content is already Tiptap format
 */
export function isTiptapContent(content: unknown): content is JSONContent {
  return isProseMirrorContent(content)
}

/**
 * Migrate Slate content to Tiptap JSON format
 */
export function migrateFromSlate(slateContent: SlateNode[]): JSONContent {
  const content: JSONContent[] = []

  for (const node of slateContent) {
    const converted = convertSlateNode(node)
    if (converted) {
      content.push(converted)
    }
  }

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  }
}

function convertSlateNode(node: SlateNode): JSONContent | null {
  // Text node
  if ('text' in node && typeof node.text === 'string') {
    const marks: JSONContent['marks'] = []

    if (node.bold) marks.push({ type: 'bold' })
    if (node.italic) marks.push({ type: 'italic' })
    if (node.underline) marks.push({ type: 'underline' })
    if (node.strikethrough) marks.push({ type: 'strike' })
    if (node.code) marks.push({ type: 'code' })
    if (node.highlight) marks.push({ type: 'highlight' })
    if (node.link) marks.push({ type: 'link', attrs: { href: node.link } })

    return {
      type: 'text',
      text: node.text,
      ...(marks.length > 0 ? { marks } : {}),
    }
  }

  const type = node.type || 'paragraph'
  const children = node.children || []

  switch (type) {
    case 'paragraph':
      return {
        type: 'paragraph',
        content: children.map(convertSlateNode).filter(Boolean) as JSONContent[],
      }

    case 'heading':
    case 'heading-one':
    case 'heading-two':
    case 'heading-three':
    case 'heading-four': {
      let level = 1
      if (type === 'heading-two' || node.level === 2) level = 2
      if (type === 'heading-three' || node.level === 3) level = 3
      if (type === 'heading-four' || node.level === 4) level = 3 // Cap at 3

      return {
        type: 'heading',
        attrs: { level },
        content: children.map(convertSlateNode).filter(Boolean) as JSONContent[],
      }
    }

    case 'bulleted-list':
    case 'bullet-list':
    case 'bulletList':
      return {
        type: 'bulletList',
        content: children.map(convertSlateNode).filter(Boolean) as JSONContent[],
      }

    case 'numbered-list':
    case 'ordered-list':
    case 'orderedList':
      return {
        type: 'orderedList',
        content: children.map(convertSlateNode).filter(Boolean) as JSONContent[],
      }

    case 'list-item':
    case 'listItem':
      return {
        type: 'listItem',
        content: children.map(convertSlateNode).filter(Boolean) as JSONContent[],
      }

    case 'task-list':
    case 'taskList':
      return {
        type: 'taskList',
        content: children.map(convertSlateNode).filter(Boolean) as JSONContent[],
      }

    case 'task-item':
    case 'taskItem':
      return {
        type: 'taskItem',
        attrs: { checked: node.checked || false },
        content: children.map(convertSlateNode).filter(Boolean) as JSONContent[],
      }

    case 'blockquote':
    case 'block-quote':
      return {
        type: 'blockquote',
        content: children.map(convertSlateNode).filter(Boolean) as JSONContent[],
      }

    case 'code-block':
    case 'codeBlock':
      return {
        type: 'codeBlock',
        attrs: { language: node.language || 'plaintext' },
        content: children.map(convertSlateNode).filter(Boolean) as JSONContent[],
      }

    case 'callout':
      return {
        type: 'callout',
        attrs: { variant: node.variant || 'info' },
        content: children.map(convertSlateNode).filter(Boolean) as JSONContent[],
      }

    case 'toggle':
      return {
        type: 'toggle',
        attrs: { open: node.open !== false },
        content: children.map(convertSlateNode).filter(Boolean) as JSONContent[],
      }

    case 'image':
      return {
        type: 'imageBlock',
        attrs: {
          src: node.src || node.url || '',
          alt: node.alt || '',
          title: node.caption || node.title || '',
          alignment: node.alignment || 'center',
        },
      }

    case 'divider':
    case 'horizontal-rule':
    case 'horizontalRule':
      return {
        type: 'horizontalRule',
      }

    default:
      // Fallback to paragraph for unknown types
      if (children.length > 0) {
        return {
          type: 'paragraph',
          content: children.map(convertSlateNode).filter(Boolean) as JSONContent[],
        }
      }
      return null
  }
}

/**
 * Migrate ProseMirror content to Tiptap JSON format
 * (ProseMirror and Tiptap use similar formats, so this is mostly a pass-through
 * with some node type normalization)
 */
export function migrateFromProseMirror(pmContent: ProseMirrorNode): JSONContent {
  return normalizeProseMirrorNode(pmContent)
}

function normalizeProseMirrorNode(node: ProseMirrorNode): JSONContent {
  const result: JSONContent = {
    type: normalizeNodeType(node.type),
  }

  if (node.attrs) {
    result.attrs = { ...node.attrs }
    // Normalize specific attributes
    if (result.type === 'codeBlock' && 'language' in result.attrs) {
      result.attrs.language = result.attrs.language || 'plaintext'
    }
  }

  if (node.text) {
    result.text = node.text
  }

  if (node.marks) {
    result.marks = node.marks.map((mark) => ({
      type: normalizeMarkType(mark.type),
      ...(mark.attrs ? { attrs: mark.attrs } : {}),
    }))
  }

  if (node.content) {
    result.content = node.content.map(normalizeProseMirrorNode)
  }

  return result
}

function normalizeNodeType(type: string): string {
  const typeMap: Record<string, string> = {
    divider: 'horizontalRule',
    'horizontal-rule': 'horizontalRule',
    'horizontal_rule': 'horizontalRule',
    'bullet-list': 'bulletList',
    'bullet_list': 'bulletList',
    'ordered-list': 'orderedList',
    'ordered_list': 'orderedList',
    'list-item': 'listItem',
    'list_item': 'listItem',
    'task-list': 'taskList',
    'task_list': 'taskList',
    'task-item': 'taskItem',
    'task_item': 'taskItem',
    'code-block': 'codeBlock',
    'code_block': 'codeBlock',
    'hard-break': 'hardBreak',
    'hard_break': 'hardBreak',
    image: 'imageBlock',
  }

  return typeMap[type] || type
}

function normalizeMarkType(type: string): string {
  const typeMap: Record<string, string> = {
    strikethrough: 'strike',
    noteLink: 'noteLink',
    'note-link': 'noteLink',
  }

  return typeMap[type] || type
}

/**
 * Auto-detect content format and migrate to Tiptap JSON
 */
export function migrateContent(content: unknown): JSONContent {
  if (!content) {
    return { type: 'doc', content: [{ type: 'paragraph' }] }
  }

  if (typeof content === 'string') {
    // Assume markdown or plain text - will be handled by the editor
    return { type: 'doc', content: [{ type: 'paragraph' }] }
  }

  if (isSlateContent(content)) {
    return migrateFromSlate(content)
  }

  if (isProseMirrorContent(content)) {
    return migrateFromProseMirror(content)
  }

  // Unknown format, return empty doc
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

/**
 * Check if content needs migration
 */
export function needsMigration(content: unknown): boolean {
  if (!content) return false
  if (typeof content === 'string') return false

  // Slate content needs migration
  if (isSlateContent(content)) return true

  // ProseMirror content might need normalization
  if (isProseMirrorContent(content)) {
    // Check for old node type names
    const json = JSON.stringify(content)
    return (
      json.includes('"type":"divider"') ||
      json.includes('"type":"bullet-list"') ||
      json.includes('"type":"ordered-list"') ||
      json.includes('"type":"task-list"') ||
      json.includes('"type":"code-block"')
    )
  }

  return false
}
