import { numberingOf } from './numbering'
import type { RenderedCitations } from './render-html'
import type { ContentMark, ContentNode } from './types'

/**
 * For formats that only know the base schema (DOCX, EPUB): number figures
 * and equations into `attrs.label`, and replace citations, cross-references,
 * document links and the bibliography with the text a reader sees.
 */
export type LowerOptions = {
  /** Formatted citations (as for renderToHTML). Without them citations are dropped. */
  citations?: RenderedCitations
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name.startsWith('#x') || name.startsWith('#X'))
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16))
    if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)))
    return ENTITIES[name.toLowerCase()] ?? match
  })

const TAG_MARKS: Record<string, string> = {
  i: 'italic',
  em: 'italic',
  b: 'bold',
  strong: 'bold',
  sup: 'superscript',
  sub: 'subscript',
}

/** The small, escaped HTML a citation processor writes (<i>, <b>, <sup>, <sub>) as text nodes. */
export function inlineFromHtml(html: string, marks: ContentMark[] = []): ContentNode[] {
  const out: ContentNode[] = []
  const stack: string[] = []
  const pattern = /<\/?([a-z]+)[^>]*>|[^<]+/gi
  for (const match of html.matchAll(pattern)) {
    const token = match[0]
    const tag = match[1]?.toLowerCase()
    if (tag) {
      const mark = TAG_MARKS[tag]
      if (!mark) continue
      if (token.startsWith('</')) {
        const index = stack.lastIndexOf(mark)
        if (index !== -1) stack.splice(index, 1)
      } else {
        stack.push(mark)
      }
      continue
    }
    const text = decode(token)
    if (!text) continue
    const all = [...marks, ...[...new Set(stack)].map((type) => ({ type }))]
    out.push(all.length > 0 ? { type: 'text', text, marks: all } : { type: 'text', text })
  }
  return out
}

const text = (value: string): ContentNode => ({ type: 'text', text: value })

export function lowerDocument(
  doc: ContentNode | null | undefined,
  options: LowerOptions = {}
): ContentNode | null {
  if (!doc) return null
  const numbering = numberingOf(doc)
  let citation = 0

  const lowerInline = (node: ContentNode): ContentNode[] => {
    switch (node.type) {
      case 'citation': {
        const rendered = options.citations?.clusters[citation++]
        return rendered ? inlineFromHtml(rendered.html) : []
      }
      case 'crossReference': {
        const target = numbering.targets.get(String(node.attrs?.target ?? ''))
        return [text(target?.label ?? '(missing reference)')]
      }
      case 'documentLink':
        return [text(String(node.attrs?.title ?? '') || 'Untitled')]
      default:
        return [lower(node)]
    }
  }

  const lowerBlock = (node: ContentNode): ContentNode[] => {
    if (node.type !== 'bibliography') return [lower(node)]
    const entries = options.citations?.bibliography ?? []
    if (entries.length === 0) return []
    const title = String(node.attrs?.title ?? 'References')
    return [
      { type: 'heading', attrs: { level: 2 }, content: [text(title)] },
      ...entries.map((entry) => ({ type: 'paragraph', content: inlineFromHtml(entry.html) })),
    ]
  }

  const lower = (node: ContentNode): ContentNode => {
    const out: ContentNode = { ...node }
    const target = numbering.of(node)
    if ((node.type === 'figure' || node.type === 'blockMath') && target) {
      out.attrs = {
        ...node.attrs,
        label: node.type === 'blockMath' ? `(${target.number})` : target.label,
      }
    }
    if (node.content) {
      const inlineParent = TEXTBLOCKS.has(node.type ?? '')
      out.content = node.content.flatMap((child) =>
        inlineParent ? lowerInline(child) : lowerBlock(child)
      )
    }
    return out
  }

  return lower(doc)
}

const TEXTBLOCKS = new Set(['paragraph', 'heading', 'figcaption'])
