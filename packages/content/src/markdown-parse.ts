import type { JSONContent } from '@tiptap/core'
import { Marked, type MarkedExtension, type Token, type Tokens } from 'marked'

import { LEADING_EMOJI } from './markdown'

/**
 * Markdown (GFM + `$math$` + `[^n]` footnotes) → Lemma document JSON. The
 * inverse of renderToMarkdown, used for legacy Markdown-only documents, API
 * writes that send Markdown, and pasting Markdown text. DOM-free.
 *
 * The result still goes through validateContent before it is stored.
 */

type Mark = { type: string; attrs?: Record<string, unknown> }

// marked asks a block extension where it could start in the source minus its
// first character, to cut a paragraph short; only a real line start counts.
const atLineStart = (pattern: RegExp) => (src: string) => {
  const match = new RegExp(`\\n(?=${pattern.source})`).exec(src)
  return match ? match.index + 1 : undefined
}

const mathExtension: MarkedExtension = {
  extensions: [
    {
      name: 'blockMath',
      level: 'block',
      start: atLineStart(/\$\$/),
      tokenizer(src) {
        // renderToMarkdown's form keeps the TeX exactly: $$⏎tex⏎$$.
        const exact = /^\$\$\n([\s\S]*?)\n\$\$[ \t]*(?:\n|$)/.exec(src)
        if (exact) return { type: 'blockMath', raw: exact[0], text: exact[1] ?? '' }
        const match = /^\$\$[ \t]*\n?([\s\S]+?)\n?\$\$[ \t]*(?:\n|$)/.exec(src)
        if (match) return { type: 'blockMath', raw: match[0], text: (match[1] ?? '').trim() }
        return undefined
      },
    },
    {
      name: 'inlineMath',
      level: 'inline',
      start: (src) => src.indexOf('$'),
      tokenizer(src) {
        // GitLab's $`…`$: the TeX is a code span (one space trimmed from each end when both have one).
        const code = /^\$(`+)(?!`)([\s\S]*?[^`])\1\$/.exec(src)
        if (code) {
          const body = (code[2] ?? '').replace(/\n/g, ' ')
          const text = /^ [\s\S]* $/.test(body) && /[^ ]/.test(body) ? body.slice(1, -1) : body
          return { type: 'inlineMath', raw: code[0], text }
        }
        // $…$ with no space just inside the dollars and no digit right after (so "$5 and $10" stays text).
        // A backslash takes the next character with it: `\$` is a dollar, `\\` a TeX line break.
        const match = /^\$(?!\s)((?:\\[^\n]|[^\\$\n])+?)(?<!\s)\$(?!\d)/.exec(src)
        if (match) return { type: 'inlineMath', raw: match[0], text: match[1] ?? '' }
        return undefined
      },
    },
  ],
}

// Footnotes are tokens, not a text pre-pass, so `[^1]` inside code stays code.
const footnoteExtension: MarkedExtension = {
  extensions: [
    {
      name: 'footnoteDefinition',
      level: 'block',
      start: atLineStart(/\[\^[^[\]\s]+\]:/),
      tokenizer(src) {
        // The first line, then any lines indented two or more (blank lines
        // only when more indented content follows).
        const match =
          /^\[\^([^[\]\s]+)\]:[ \t]?([^\n]*(?:\n(?:[ \t]*\n)*[ \t]{2,}[^\n]*)*)(?:\n|$)/.exec(src)
        if (!match) return undefined
        const body = (match[2] ?? '').replace(/^(?: {1,4}|\t)/gm, '')
        return { type: 'footnoteDefinition', raw: match[0], label: match[1], text: body }
      },
    },
    {
      name: 'footnoteRef',
      level: 'inline',
      start: (src) => src.indexOf('[^'),
      tokenizer(src) {
        // Not a link `[^x](url)` or a definition `[^x]:`.
        const match = /^\[\^([^[\]\s]+)\](?![:(])/.exec(src)
        if (match) return { type: 'footnoteRef', raw: match[0], label: match[1] ?? '' }
        return undefined
      },
    },
  ],
}

const parser = new Marked({ gfm: true }, mathExtension, footnoteExtension)

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1))
      return Number.isFinite(n) && n <= 0x10ffff ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

const sameMarks = (a: Mark[], b: Mark[]) =>
  a.length === b.length && a.every((mark, i) => JSON.stringify(mark) === JSON.stringify(b[i]))

function pushText(out: JSONContent[], text: string, marks: Mark[]): void {
  if (!text) return
  const last = out[out.length - 1]
  if (last?.type === 'text' && sameMarks((last.marks as Mark[]) ?? [], marks)) {
    last.text = (last.text ?? '') + text
    return
  }
  out.push(marks.length > 0 ? { type: 'text', text, marks: [...marks] } : { type: 'text', text })
}

const withMarks = (node: JSONContent, marks: Mark[]): JSONContent =>
  marks.length > 0 ? { ...node, marks: [...marks] } : node

const HTML_MARKS: Record<string, string> = {
  sup: 'superscript',
  sub: 'subscript',
  u: 'underline',
  ins: 'underline',
  mark: 'highlight',
  b: 'bold',
  strong: 'bold',
  i: 'italic',
  em: 'italic',
  s: 'strike',
  del: 'strike',
  code: 'code',
}

/** Footnote labels with a definition, and the order their notes are listed in. */
type Context = { definitions: Map<string, string>; order: string[]; inNote: boolean }

type InlineResult = { inline: JSONContent[]; images: JSONContent[] }

// Plain text of inline tokens (image alt text).
function plainText(tokens: Token[] | undefined): string {
  return (tokens ?? [])
    .map((token) => {
      if (token.type === 'escape') return token.text
      if ('tokens' in token && Array.isArray(token.tokens)) return plainText(token.tokens)
      if (token.type === 'text' || token.type === 'codespan')
        return token.type === 'text' ? decodeEntities(token.text) : token.text
      return 'text' in token && typeof token.text === 'string' ? token.text : ''
    })
    .join('')
}

function inlineTokens(
  tokens: Token[] | undefined,
  ctx: Context,
  marks: Mark[] = [],
  result?: InlineResult
): InlineResult {
  const res = result ?? { inline: [], images: [] }
  const htmlStack: Mark[] = []
  const current = () => [...marks, ...htmlStack]
  for (const token of tokens ?? []) {
    switch (token.type) {
      case 'text':
        if ('tokens' in token && token.tokens?.length)
          inlineTokens(token.tokens, ctx, current(), res)
        else pushText(res.inline, decodeEntities(token.text), current())
        break
      case 'escape':
        pushText(res.inline, token.text, current())
        break
      case 'strong':
        inlineTokens(token.tokens, ctx, [...current(), { type: 'bold' }], res)
        break
      case 'em':
        inlineTokens(token.tokens, ctx, [...current(), { type: 'italic' }], res)
        break
      case 'del':
        inlineTokens(token.tokens, ctx, [...current(), { type: 'strike' }], res)
        break
      case 'codespan':
        // The code mark excludes all others (bold/italic/links), as in the editor.
        // Code spans are literal: no entity decoding.
        pushText(res.inline, token.text, [{ type: 'code' }])
        break
      case 'br':
        res.inline.push(withMarks({ type: 'hardBreak' }, current()))
        break
      case 'link': {
        const title = token.title == null ? null : decodeEntities(token.title)
        const link: Mark = { type: 'link', attrs: { href: token.href, title } }
        inlineTokens(token.tokens, ctx, [...current(), link], res)
        break
      }
      case 'image':
        res.images.push({
          type: 'image',
          attrs: {
            src: token.href,
            alt: plainText(token.tokens) || null,
            title: token.title == null ? null : decodeEntities(token.title),
          },
        })
        break
      case 'inlineMath':
        res.inline.push(
          withMarks(
            { type: 'inlineMath', attrs: { latex: (token as Tokens.Generic).text } },
            current()
          )
        )
        break
      case 'footnoteRef': {
        const label = String((token as Tokens.Generic).label)
        if (ctx.inNote || !ctx.definitions.has(label)) {
          pushText(res.inline, token.raw, current())
          break
        }
        if (!ctx.order.includes(label)) ctx.order.push(label)
        res.inline.push(
          withMarks({ type: 'footnoteReference', attrs: { id: footnoteId(label) } }, current())
        )
        break
      }
      case 'html': {
        const tag = /^<\s*(\/?)\s*([a-z]+)[^>]*?(\/?)>$/i.exec(token.raw.trim())
        if (!tag) {
          pushText(res.inline, token.raw, current())
          break
        }
        const [, closing, name = '', selfClosing] = tag
        if (name.toLowerCase() === 'br') {
          res.inline.push(withMarks({ type: 'hardBreak' }, current()))
          break
        }
        const markType = HTML_MARKS[name.toLowerCase()]
        if (!markType || selfClosing) break
        if (closing) {
          const at = htmlStack.map((m) => m.type).lastIndexOf(markType)
          if (at !== -1) htmlStack.splice(at, 1)
        } else {
          htmlStack.push({ type: markType })
        }
        break
      }
      default:
        if ('tokens' in token && Array.isArray(token.tokens))
          inlineTokens(token.tokens, ctx, current(), res)
        else if ('text' in token && typeof token.text === 'string')
          pushText(res.inline, token.text, current())
    }
  }
  return res
}

const YOUTUBE =
  /^https?:\/\/(?:(?:www|m|music)\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)/i

/**
 * renderToMarkdown writes a YouTube embed as `[Video](url)` alone in its
 * paragraph; a bare YouTube URL on its own line (legacy Markdown) counts too.
 * A plain link to YouTube is written with a `<url>` destination instead.
 */
function embedLink(tokens: Token[] | undefined): string | null {
  const [only, ...rest] = tokens ?? []
  if (!only || rest.length > 0 || only.type !== 'link') return null
  const link = only as Tokens.Link
  if (link.title || !YOUTUBE.test(link.href) || /\]\(\s*</.test(link.raw)) return null
  return link.text === 'Video' || link.text === link.href ? link.href : null
}

// Paragraph-ish token → a paragraph, plus any images it contained hoisted to blocks.
function paragraphBlocks(tokens: Token[] | undefined, ctx: Context): JSONContent[] {
  const embed = embedLink(tokens)
  if (embed) return [{ type: 'youtube', attrs: { src: embed } }]
  const { inline, images } = inlineTokens(tokens, ctx)
  const blocks: JSONContent[] = []
  // Whitespace between hoisted images isn't a paragraph; whitespace alone is.
  const meaningful =
    images.length === 0
      ? inline.length > 0
      : inline.some((node) => node.type !== 'text' || (node.text ?? '').trim())
  if (meaningful) blocks.push({ type: 'paragraph', content: inline })
  blocks.push(...images)
  return blocks
}

// renderToMarkdown writes callouts as "> 💡 text"; a blockquote that merely
// starts with an emoji has it written as entities.
const CALLOUT_LEAD = new RegExp(`^(${LEADING_EMOJI.source.slice(1)})(?: |$)`, 'u')

function blockTokens(tokens: Token[], ctx: Context): JSONContent[] {
  const out: JSONContent[] = []
  for (const token of tokens) {
    switch (token.type) {
      case 'space':
      case 'def':
      case 'footnoteDefinition':
        break
      case 'heading':
        out.push({
          type: 'heading',
          attrs: { level: Math.min(6, Math.max(1, token.depth)) },
          content: inlineTokens(token.tokens, ctx).inline,
        })
        break
      case 'paragraph':
      case 'text':
        out.push(
          ...paragraphBlocks('tokens' in token && token.tokens ? token.tokens : [token], ctx)
        )
        break
      case 'blockquote': {
        const firstToken = (token.tokens ?? []).find((t) => t.type !== 'space')
        const lead = firstToken?.type === 'paragraph' ? CALLOUT_LEAD.exec(firstToken.raw) : null
        const inner = blockTokens(token.tokens ?? [], ctx)
        const first = inner[0]?.content?.[0]
        if (lead && first?.type === 'text' && first.text?.startsWith(lead[0].trimEnd())) {
          first.text = first.text.slice(lead[0].length)
          if (!first.text) inner[0]?.content?.shift()
          // An emoji on its own line leaves an empty first paragraph behind.
          if (inner[0]?.content?.length === 0 && inner.length > 1) inner.shift()
        }
        // A bare ">" still needs one block inside.
        if (inner.length === 0) inner.push({ type: 'paragraph' })
        out.push(
          lead
            ? { type: 'callout', attrs: { emoji: lead[1] }, content: inner }
            : { type: 'blockquote', content: inner }
        )
        break
      }
      case 'list': {
        const list = token as Tokens.List
        // GFM needs text after "[ ]"; an empty task item is just the box.
        const emptyBox = (item: Tokens.ListItem) => {
          const first = item.tokens[0]
          return !item.task && first !== undefined && /^\[[ xX]\]$/.test(first.raw.trim())
            ? first
            : null
        }
        const isTask = list.items.some((item) => item.task || emptyBox(item))
        const items = list.items.map((item) => {
          const box = emptyBox(item)
          const content = blockTokens(
            item.tokens.filter((t) => t.type !== 'checkbox' && t !== box),
            ctx
          )
          // The box alone stands for an empty first paragraph.
          if (box || content[0]?.type !== 'paragraph') content.unshift({ type: 'paragraph' })
          const checked = box ? /x/i.test(box.raw) : Boolean(item.checked)
          return isTask
            ? { type: 'taskItem', attrs: { checked }, content }
            : { type: 'listItem', content }
        })
        const start = Number(list.start)
        if (isTask) out.push({ type: 'taskList', content: items })
        else if (list.ordered)
          out.push({
            type: 'orderedList',
            attrs: { start: list.start !== '' && Number.isFinite(start) ? start : 1 },
            content: items,
          })
        else out.push({ type: 'bulletList', content: items })
        break
      }
      case 'code':
        out.push({
          type: 'codeBlock',
          attrs: { language: token.lang?.trim() || null },
          content: token.text ? [{ type: 'text', text: token.text }] : [],
        })
        break
      case 'blockMath':
        out.push({ type: 'blockMath', attrs: { latex: (token as Tokens.Generic).text } })
        break
      case 'hr':
        out.push({ type: 'horizontalRule' })
        break
      case 'table': {
        const table = token as Tokens.Table
        const cell = (type: string, c: Tokens.TableCell) => ({
          type,
          content: [{ type: 'paragraph', content: inlineTokens(c.tokens, ctx).inline }],
        })
        out.push({
          type: 'table',
          content: [
            { type: 'tableRow', content: table.header.map((c) => cell('tableHeader', c)) },
            ...table.rows.map((row) => ({
              type: 'tableRow',
              content: row.map((c) => cell('tableCell', c)),
            })),
          ],
        })
        break
      }
      case 'html': {
        // renderToMarkdown's form for code marked would mangle (tabs in a list,
        // U+2028/U+2029): entities in a <pre><code>.
        const pre = /^<pre><code(?: class="language-([^"]*)")?>([\s\S]*)<\/code><\/pre>\s*$/.exec(
          token.text
        )
        if (pre) {
          const text = decodeEntities(pre[2] ?? '')
          out.push({
            type: 'codeBlock',
            attrs: { language: pre[1] ? decodeEntities(pre[1]) : null },
            content: text ? [{ type: 'text', text }] : [],
          })
          break
        }
        // A line of only <br> is a paragraph of line breaks.
        if (/^\s*(?:<br\s*\/?>\s*)+$/i.test(token.text)) {
          const breaks = token.text.match(/<br/gi) ?? []
          out.push({ type: 'paragraph', content: breaks.map(() => ({ type: 'hardBreak' })) })
          break
        }
        // Other block HTML has no faithful place in the model; keep its text.
        const text = token.text
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (text)
          out.push({ type: 'paragraph', content: [{ type: 'text', text: decodeEntities(text) }] })
        break
      }
      default:
        if ('tokens' in token && Array.isArray(token.tokens))
          out.push(...paragraphBlocks(token.tokens, ctx))
    }
  }
  return out
}

const footnoteId = (label: string) => `fn-${label.replace(/[^\w-]/g, '').slice(0, 32) || 'note'}`

export function markdownToContent(markdown: string): JSONContent {
  const tokens = parser.lexer(markdown.replace(/\r\n?/g, '\n'))

  // Definitions can follow their references, so collect them first.
  const definitions = new Map<string, string>()
  for (const token of tokens) {
    if (token.type !== 'footnoteDefinition') continue
    const { label, text } = token as Tokens.Generic
    if (!definitions.has(label)) definitions.set(label, text)
  }

  const ctx: Context = { definitions, order: [], inNote: false }
  const content = blockTokens(tokens, ctx)

  if (ctx.order.length > 0) {
    const noteCtx: Context = { ...ctx, order: [], inNote: true }
    content.push({
      type: 'footnotes',
      content: ctx.order.map((label) => {
        const body = blockTokens(parser.lexer(definitions.get(label) ?? ''), noteCtx).filter(
          (node) => node.type === 'paragraph'
        )
        return {
          type: 'footnote',
          attrs: { id: footnoteId(label) },
          content: body.length > 0 ? body : [{ type: 'paragraph' }],
        }
      }),
    })
  }

  if (content.length === 0) content.push({ type: 'paragraph' })
  return { type: 'doc', content }
}
