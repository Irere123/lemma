import { numberDocument } from './numbering'
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

type Labels = { get: (id: string) => string | undefined }

function walkText(node: ContentNode | null | undefined, out: string[], labels: Labels): void {
  if (!node) return

  if (typeof node.text === 'string') {
    out.push(node.text)
  }
  // Inline atoms that read as words: a link to a document reads as its title,
  // a cross-reference as its label ("Figure 2").
  if (node.type === 'documentLink') out.push(String(node.attrs?.title ?? ''))
  if (node.type === 'crossReference') out.push(labels.get(String(node.attrs?.target ?? '')) ?? '')

  if (node.content) {
    for (const child of node.content) {
      walkText(child, out, labels)
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
  // Numbered only if something refers to a target.
  let targets: ReturnType<typeof numberDocument> | null = null
  const labels: Labels = {
    get: (id) => {
      targets ??= numberDocument(doc)
      return targets.get(id)?.label
    },
  }
  walkText(doc, parts, labels)
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

/**
 * The text an excerpt is cut from: the body without its headings (a post
 * that opens with "Introduction" shouldn't preview as "Introduction The…"),
 * and with no gap left before punctuation where an inline citation or
 * reference added no words of its own.
 */
function excerptText(doc: ContentDoc | null | undefined): string {
  if (!doc?.content) return ''
  const body = doc.content.filter((node) => node.type !== 'heading')
  const text = extractText({ ...doc, content: body.length > 0 ? body : doc.content })
  return text.replace(/\s+([,.;:!?…)\]])/g, '$1')
}

export function summarize(doc: ContentDoc | null | undefined, excerptLength = 200): ContentSummary {
  const text = extractText(doc)
  const words = countWords(text)
  return {
    text,
    words,
    readingTime: readingTime(words),
    excerpt: excerpt(excerptText(doc), excerptLength),
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
