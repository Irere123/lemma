import type { ContentDoc, ContentNode, ContentSummary } from './types'

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'taskItem',
  'horizontalRule',
])

const WORDS_PER_MINUTE = 225

function walkText(node: ContentNode | null | undefined, out: string[]): void {
  if (!node) return

  if (typeof node.text === 'string') {
    out.push(node.text)
  }

  if (node.content) {
    for (const child of node.content) {
      walkText(child, out)
    }
  }

  // Separate block-level nodes so their words don't run together.
  if (node.type && BLOCK_TYPES.has(node.type)) {
    out.push(' ')
  }
}

export function extractText(doc: ContentDoc | null | undefined): string {
  if (!doc) return ''
  const parts: string[] = []
  walkText(doc, parts)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export function readingTime(words: number): string {
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  return `${minutes} min read`
}

export function excerpt(text: string, maxLength = 200): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) return trimmed

  const sliced = trimmed.slice(0, maxLength)
  const lastSpace = sliced.lastIndexOf(' ')
  const base = lastSpace > maxLength * 0.6 ? sliced.slice(0, lastSpace) : sliced
  return `${base.trimEnd()}…`
}

export function summarize(doc: ContentDoc | null | undefined, excerptLength = 200): ContentSummary {
  const text = extractText(doc)
  const words = countWords(text)
  return {
    text,
    words,
    readingTime: readingTime(words),
    excerpt: excerpt(text, excerptLength),
  }
}
