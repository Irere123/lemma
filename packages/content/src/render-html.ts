import type { ContentDoc, ContentMark, ContentNode } from './types'

/**
 * DOM-free JSON → HTML renderer (runs in the Worker). Safe by construction:
 * text is escaped and URLs sanitized. Per-node classes mirror the editor's
 * extension config so reader output matches the editor — keep them in sync.
 */

const CLASS = {
  bulletList: 'my-4 ml-6 list-disc',
  orderedList: 'my-4 ml-6 list-decimal',
  listItem: 'my-1 leading-7',
  blockquote: 'my-6 border-l-2 border-border pl-5 text-muted-foreground italic',
  codeBlock:
    'my-6 overflow-x-auto rounded-xl border border-border bg-muted/60 p-4 font-mono text-sm',
  code: 'rounded-md border border-border/70 bg-muted/70 px-1 py-0.5 font-mono text-sm',
  link: 'text-foreground underline decoration-muted-foreground underline-offset-[3px] transition-colors hover:decoration-foreground',
  image: 'my-6 rounded-xl border border-border',
  taskList: 'not-prose my-4 pl-2',
  taskItem: 'my-2 flex items-start gap-2',
  taskItemBody: 'min-w-0 flex-1',
  horizontalRule: 'my-8 border-t border-border',
  youtube: 'my-6 aspect-video w-full overflow-hidden rounded-xl border border-border',
  math: 'rounded px-1 text-foreground',
} as const

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Allow only safe URL schemes; block javascript:/vbscript:, and data: unless allowed.
export function sanitizeUrl(url: unknown, { allowData = false } = {}): string | null {
  if (typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null

  if (/^(\/|#|\.\/|\.\.\/)/.test(trimmed)) return trimmed

  const match = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)
  if (!match) return trimmed

  const scheme = (match[1] ?? '').toLowerCase()
  const allowed = new Set(['http', 'https', 'mailto', 'tel'])
  if (allowData) allowed.add('data')
  return allowed.has(scheme) ? trimmed : null
}

function attr(name: string, value: unknown): string {
  if (value === null || value === undefined || value === false) return ''
  if (value === true) return ` ${name}`
  return ` ${name}="${escapeHtml(String(value))}"`
}

function getAttr<T = unknown>(node: ContentNode, key: string): T | undefined {
  return node.attrs?.[key] as T | undefined
}

function cellAttrs(node: ContentNode): string {
  const colspan = Number(getAttr(node, 'colspan') ?? 1)
  const rowspan = Number(getAttr(node, 'rowspan') ?? 1)
  return (
    (Number.isFinite(colspan) && colspan > 1 ? attr('colspan', colspan) : '') +
    (Number.isFinite(rowspan) && rowspan > 1 ? attr('rowspan', rowspan) : '')
  )
}

function openMark(mark: ContentMark): string {
  switch (mark.type) {
    case 'bold':
    case 'strong':
      return '<strong>'
    case 'italic':
    case 'em':
      return '<em>'
    case 'strike':
    case 'strikethrough':
      return '<s>'
    case 'underline':
      return '<u>'
    case 'superscript':
      return '<sup>'
    case 'subscript':
      return '<sub>'
    case 'code':
      return `<code class="${CLASS.code}">`
    case 'link': {
      const href = sanitizeUrl(mark.attrs?.href)
      if (!href) return '<span>'
      return `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow" target="_blank" class="${CLASS.link}">`
    }
    case 'highlight': {
      const color = mark.attrs?.color
      const style =
        typeof color === 'string' ? ` style="background-color:${escapeHtml(color)}"` : ''
      return `<mark${style}>`
    }
    case 'textStyle': {
      const color = mark.attrs?.color
      if (typeof color === 'string') return `<span style="color:${escapeHtml(color)}">`
      return '<span>'
    }
    default:
      return '<span>'
  }
}

function closeMark(mark: ContentMark): string {
  switch (mark.type) {
    case 'bold':
    case 'strong':
      return '</strong>'
    case 'italic':
    case 'em':
      return '</em>'
    case 'strike':
    case 'strikethrough':
      return '</s>'
    case 'underline':
      return '</u>'
    case 'superscript':
      return '</sup>'
    case 'subscript':
      return '</sub>'
    case 'code':
      return '</code>'
    case 'link':
      // A blocked href falls back to <span> in openMark; close to match.
      return sanitizeUrl(mark.attrs?.href) ? '</a>' : '</span>'
    case 'highlight':
      return '</mark>'
    default:
      return '</span>'
  }
}

function renderText(node: ContentNode): string {
  const text = escapeHtml(node.text ?? '')
  const marks = node.marks ?? []
  if (marks.length === 0) return text

  let open = ''
  let close = ''
  for (const mark of marks) {
    open += openMark(mark)
    close = closeMark(mark) + close
  }
  return open + text + close
}

function renderChildren(node: ContentNode): string {
  if (!node.content) return ''
  return node.content.map(renderNode).join('')
}

function rawText(node: ContentNode): string {
  if (typeof node.text === 'string') return node.text
  if (!node.content) return ''
  return node.content.map(rawText).join('')
}

function youtubeEmbedUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const url = raw.trim()
  const embed = /youtube\.com\/embed\/([\w-]+)/.exec(url)
  if (embed) return `https://www.youtube.com/embed/${embed[1]}`
  const watch = /[?&]v=([\w-]+)/.exec(url)
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`
  const short = /youtu\.be\/([\w-]+)/.exec(url)
  if (short) return `https://www.youtube.com/embed/${short[1]}`
  return null
}

function renderNode(node: ContentNode): string {
  switch (node.type) {
    case undefined:
    case 'doc':
      return renderChildren(node)

    case 'paragraph':
      return `<p>${renderChildren(node)}</p>`

    case 'heading': {
      const raw = Number(getAttr(node, 'level') ?? 1)
      const level = Math.min(3, Math.max(1, Number.isFinite(raw) ? raw : 1))
      return `<h${level}>${renderChildren(node)}</h${level}>`
    }

    case 'text':
      return renderText(node)

    case 'hardBreak':
      return '<br>'

    case 'bulletList':
      return `<ul class="${CLASS.bulletList}">${renderChildren(node)}</ul>`

    case 'orderedList': {
      const start = Number(getAttr(node, 'start') ?? 1)
      const startAttr = Number.isFinite(start) && start > 1 ? attr('start', start) : ''
      return `<ol class="${CLASS.orderedList}"${startAttr}>${renderChildren(node)}</ol>`
    }

    case 'listItem':
      return `<li class="${CLASS.listItem}">${renderChildren(node)}</li>`

    case 'taskList':
      return `<ul class="${CLASS.taskList}">${renderChildren(node)}</ul>`

    case 'taskItem': {
      const checked = getAttr(node, 'checked') === true
      const checkbox = `<input type="checkbox" disabled${checked ? ' checked' : ''}>`
      return `<li class="${CLASS.taskItem}">${checkbox}<div class="${CLASS.taskItemBody}">${renderChildren(node)}</div></li>`
    }

    case 'blockquote':
      return `<blockquote class="${CLASS.blockquote}">${renderChildren(node)}</blockquote>`

    case 'codeBlock': {
      const language = getAttr<string>(node, 'language')
      const langClass = language ? ` class="language-${escapeHtml(language)}"` : ''
      return `<pre class="${CLASS.codeBlock}"><code${langClass}>${escapeHtml(rawText(node))}</code></pre>`
    }

    case 'horizontalRule':
      return `<hr class="${CLASS.horizontalRule}">`

    case 'image': {
      const src = sanitizeUrl(getAttr(node, 'src'), { allowData: true })
      if (!src) return ''
      return `<img src="${escapeHtml(src)}"${attr('alt', getAttr(node, 'alt') ?? '')}${attr('title', getAttr(node, 'title'))} class="${CLASS.image}">`
    }

    case 'youtube':
    case 'iframe': {
      const embed = youtubeEmbedUrl(getAttr(node, 'src'))
      if (!embed) return ''
      return `<div class="${CLASS.youtube}"><iframe src="${escapeHtml(embed)}" width="100%" height="100%" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
    }

    case 'math': {
      // LaTeX source in a marked span; the reader hydrates it with KaTeX so
      // KaTeX stays out of the Worker bundle.
      const latex = String(getAttr(node, 'latex') ?? '')
      return `<span class="${CLASS.math}" data-type="math" data-latex="${escapeHtml(latex)}">${escapeHtml(latex)}</span>`
    }

    case 'callout': {
      const emoji = escapeHtml(String(getAttr(node, 'emoji') ?? '💡'))
      return `<div class="callout"><span class="callout-icon" aria-hidden="true">${emoji}</span><div class="callout-body">${renderChildren(node)}</div></div>`
    }

    case 'table':
      return `<div class="writer-table-wrap"><table>${renderChildren(node)}</table></div>`

    case 'tableRow':
      return `<tr>${renderChildren(node)}</tr>`

    case 'tableHeader':
      return `<th${cellAttrs(node)}>${renderChildren(node)}</th>`

    case 'tableCell':
      return `<td${cellAttrs(node)}>${renderChildren(node)}</td>`

    default:
      // Unknown node: render children so future block types degrade gracefully.
      return renderChildren(node)
  }
}

export function renderToHTML(doc: ContentDoc | null | undefined): string {
  if (!doc) return ''
  return renderNode(doc)
}
