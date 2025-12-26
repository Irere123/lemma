import type { JSONContent } from '@tiptap/core'

/**
 * Markdown serialization utilities for Tiptap content
 *
 * Note: The main markdown conversion is handled by the tiptap-markdown extension
 * within the editor. This module provides additional utilities for:
 * - Server-side markdown generation
 * - Custom block serialization
 */

/**
 * Convert Tiptap JSON content to Markdown
 * This is a lightweight serializer for server-side use
 */
export function toMarkdown(content: JSONContent): string {
  if (!content || content.type !== 'doc') {
    return ''
  }

  return (content.content || []).map(serializeNode).join('\n\n')
}

function serializeNode(node: JSONContent, depth = 0): string {
  switch (node.type) {
    case 'paragraph':
      return serializeInlineContent(node.content)

    case 'heading': {
      const level = node.attrs?.level || 1
      const prefix = '#'.repeat(Math.min(level, 6))
      return `${prefix} ${serializeInlineContent(node.content)}`
    }

    case 'bulletList':
      return (node.content || []).map((item) => serializeListItem(item, '- ', depth)).join('\n')

    case 'orderedList':
      return (node.content || [])
        .map((item, index) => serializeListItem(item, `${index + 1}. `, depth))
        .join('\n')

    case 'listItem':
      return (node.content || []).map(serializeNode).join('\n')

    case 'taskList':
      return (node.content || [])
        .map((item) => {
          const checked = item.attrs?.checked ? 'x' : ' '
          const content = (item.content || []).map(serializeNode).join('\n')
          return `- [${checked}] ${content}`
        })
        .join('\n')

    case 'taskItem': {
      const checked = node.attrs?.checked ? 'x' : ' '
      return `- [${checked}] ${serializeInlineContent(node.content)}`
    }

    case 'blockquote':
      return (node.content || [])
        .map(serializeNode)
        .map((line) => `> ${line}`)
        .join('\n')

    case 'codeBlock': {
      const language = node.attrs?.language || ''
      const code = (node.content || []).map((n) => n.text || '').join('')
      return `\`\`\`${language}\n${code}\n\`\`\``
    }

    case 'callout': {
      const variant = node.attrs?.variant || 'info'
      const content = (node.content || []).map(serializeNode).join('\n')
      return `> [!${variant.toUpperCase()}]\n> ${content.split('\n').join('\n> ')}`
    }

    case 'toggle': {
      const summary = node.attrs?.summary || 'Toggle'
      const content = (node.content || []).map(serializeNode).join('\n')
      return `<details>\n<summary>${summary}</summary>\n\n${content}\n</details>`
    }

    case 'imageBlock':
    case 'image': {
      const { src, alt, title } = node.attrs || {}
      const altText = alt || ''
      const titleAttr = title ? ` "${title}"` : ''
      return `![${altText}](${src}${titleAttr})`
    }

    case 'horizontalRule':
      return '---'

    case 'hardBreak':
      return '  \n'

    case 'text':
      return serializeText(node)

    default:
      // Fallback for unknown node types
      if (node.content) {
        return (node.content || []).map(serializeNode).join('\n')
      }
      return node.text || ''
  }
}

function serializeListItem(item: JSONContent, prefix: string, depth: number): string {
  const indent = '  '.repeat(depth)
  const content = (item.content || []).map(serializeNode).join('\n')
  const lines = content.split('\n')
  return lines
    .map((line, i) => (i === 0 ? `${indent}${prefix}${line}` : `${indent}  ${line}`))
    .join('\n')
}

function serializeInlineContent(content?: JSONContent[]): string {
  if (!content) return ''
  return content.map(serializeText).join('')
}

function serializeText(node: JSONContent): string {
  let text = node.text || ''

  if (!node.marks) return text

  for (const mark of node.marks) {
    switch (mark.type) {
      case 'bold':
        text = `**${text}**`
        break
      case 'italic':
        text = `*${text}*`
        break
      case 'strike':
        text = `~~${text}~~`
        break
      case 'code':
        text = `\`${text}\``
        break
      case 'link':
        text = `[${text}](${mark.attrs?.href || ''})`
        break
      case 'highlight':
        text = `==${text}==`
        break
      case 'noteLink':
        text = `[[${mark.attrs?.noteId || text}|${text}]]`
        break
    }
  }

  return text
}

/**
 * Parse markdown string to Tiptap JSON (basic parser)
 * Note: For full markdown parsing, use the tiptap-markdown extension
 */
export function fromMarkdown(markdown: string): JSONContent {
  // This is a minimal implementation
  // The tiptap-markdown extension handles this more comprehensively
  const lines = markdown.split('\n')
  const content: JSONContent[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Skip empty lines
    if (!line.trim()) {
      i++
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      content.push({
        type: 'heading',
        attrs: { level: Math.min(headingMatch[1].length, 3) },
        content: [{ type: 'text', text: headingMatch[2] }],
      })
      i++
      continue
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      content.push({ type: 'horizontalRule' })
      i++
      continue
    }

    // Code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || 'plaintext'
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      content.push({
        type: 'codeBlock',
        attrs: { language },
        content: [{ type: 'text', text: codeLines.join('\n') }],
      })
      i++
      continue
    }

    // Default: paragraph
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    })
    i++
  }

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  }
}

/**
 * Get plain text from Tiptap JSON content
 */
export function toPlainText(content: JSONContent): string {
  if (!content) return ''

  if (content.text) {
    return content.text
  }

  if (content.content) {
    return content.content.map(toPlainText).join('')
  }

  return ''
}

/**
 * Count words in Tiptap JSON content
 */
export function countWords(content: JSONContent): number {
  const text = toPlainText(content)
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Count characters in Tiptap JSON content
 */
export function countCharacters(content: JSONContent): number {
  return toPlainText(content).length
}
