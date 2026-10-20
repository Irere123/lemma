import type { ContentDoc, ContentNode, ContentSummary } from './types'

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'taskItem',
  'horizontalRule',
  'tableCell',
  'tableHeader',
  'callout',
  'footnote',
  'blockMath',
  'hardBreak',
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

/**
 * Split plain text into pieces of at most ~`size` characters on word
 * boundaries, so a book can be indexed without any single row approaching
 * D1's 2 MB value limit.
 */
export function chunkText(text: string, size = 32_000): string[] {
  const chunks: string[] = []
  let rest = text.trim()
  while (rest.length > size) {
    let cut = rest.lastIndexOf(' ', size)
    if (cut < size * 0.5) cut = size
    chunks.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) chunks.push(rest)
  return chunks
}
