import { footnoteOrder, youtubeVideoId } from './render-html'
import { escapeHtml, safeCssColor, sanitizeUrl } from './sanitize'
import type { ContentDoc, ContentMark, ContentNode } from './types'

// Email-safe renderer: inline styles only (clients strip CSS/JS), tables for
// layout, embeds degrade to links. Same node coverage as renderToHTML.

export type EmailRenderOptions = {
  /** TeX → MathML (KaTeX in the API). Without it, the TeX source is shown in monospace. */
  renderMath?: (latex: string, displayMode: boolean) => string | null
}

type Context = {
  options: EmailRenderOptions
  footnoteNumbers: Map<string, number>
}

const S = {
  text: 'margin:0 0 16px;font-size:16px;line-height:1.7;color:#1a1a1a',
  h1: 'margin:32px 0 12px;font-size:26px;line-height:1.25;font-weight:700;color:#111',
  h2: 'margin:28px 0 10px;font-size:21px;line-height:1.3;font-weight:700;color:#111',
  h3: 'margin:22px 0 8px;font-size:18px;line-height:1.35;font-weight:700;color:#111',
  h4: 'margin:20px 0 8px;font-size:16px;line-height:1.4;font-weight:700;color:#111',
  h5: 'margin:18px 0 6px;font-size:15px;line-height:1.4;font-weight:700;color:#111',
  h6: 'margin:16px 0 6px;font-size:14px;line-height:1.4;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:0.04em',
  list: 'margin:0 0 16px;padding-left:24px;font-size:16px;line-height:1.7;color:#1a1a1a',
  li: 'margin:0 0 6px',
  taskList:
    'margin:0 0 16px;padding-left:0;list-style:none;font-size:16px;line-height:1.7;color:#1a1a1a',
  taskItem: 'margin:0 0 6px;list-style:none',
  blockquote:
    'margin:0 0 16px;padding:4px 0 4px 16px;border-left:3px solid #d4d4d4;color:#555;font-style:italic',
  code: 'padding:1px 5px;background:#f1f1f1;border-radius:4px;font-family:monospace;font-size:14px',
  pre: 'margin:0 0 16px;padding:14px;background:#f6f6f6;border:1px solid #e5e5e5;border-radius:8px;overflow:auto;font-family:monospace;font-size:14px;line-height:1.5;white-space:pre-wrap',
  img: 'display:block;max-width:100%;height:auto;margin:20px auto;border-radius:8px',
  hr: 'margin:28px 0;border:0;border-top:1px solid #e5e5e5',
  link: 'color:#1a1a1a;text-decoration:underline',
  callout:
    'margin:0 0 16px;padding:14px 16px;background:#f6f6f6;border:1px solid #e5e5e5;border-radius:10px',
  table: 'border-collapse:collapse;width:100%;margin:0 0 16px;font-size:15px',
  cell: 'border:1px solid #e0e0e0;padding:8px 10px;text-align:left;vertical-align:top',
  th: 'border:1px solid #e0e0e0;padding:8px 10px;text-align:left;background:#f6f6f6;font-weight:600',
  button:
    'display:inline-block;margin:4px 0 16px;padding:10px 18px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600',
  mathBlock: 'margin:0 0 16px;text-align:center;font-size:17px',
  mathSource: 'font-family:monospace;font-size:14px',
  footnotes:
    'margin:32px 0 0;padding:16px 0 0 20px;border-top:1px solid #e5e5e5;font-size:14px;line-height:1.6;color:#444',
  footnoteRef: 'font-size:12px;line-height:0;vertical-align:super',
} as const

const HEADING = [S.h1, S.h2, S.h3, S.h4, S.h5, S.h6] as const

function getAttr<T = unknown>(node: ContentNode, key: string): T | undefined {
  return node.attrs?.[key] as T | undefined
}

function positiveInt(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

function cellAttrs(node: ContentNode): string {
  const colspan = positiveInt(getAttr(node, 'colspan'))
  const rowspan = positiveInt(getAttr(node, 'rowspan'))
  const widths = getAttr<unknown[]>(node, 'colwidth')
  const total = Array.isArray(widths)
    ? widths
        .map(positiveInt)
        .reduce<number | null>((sum, w) => (sum === null || w === null ? null : sum + w), 0)
    : null
  let out = ''
  if (colspan && colspan > 1) out += ` colspan="${colspan}"`
  if (rowspan && rowspan > 1) out += ` rowspan="${rowspan}"`
  if (total) out += ` width="${total}"`
  return out
}

function watchUrl(raw: unknown, start: unknown): string | null {
  const id = youtubeVideoId(raw)
  if (!id) return sanitizeUrl(raw)
  const seconds = positiveInt(start)
  return `https://www.youtube.com/watch?v=${id}${seconds ? `&t=${seconds}s` : ''}`
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
      return `<code style="${S.code}">`
    case 'link': {
      const href = sanitizeUrl(mark.attrs?.href)
      return href ? `<a href="${escapeHtml(href)}" style="${S.link}">` : '<span>'
    }
    case 'highlight': {
      const color = safeCssColor(mark.attrs?.color) ?? '#fef08a'
      return `<span style="background-color:${color};padding:0 2px">`
    }
    case 'textStyle': {
      const color = safeCssColor(mark.attrs?.color)
      return color ? `<span style="color:${color}">` : '<span>'
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
      return sanitizeUrl(mark.attrs?.href) ? '</a>' : '</span>'
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

function renderChildren(node: ContentNode, ctx: Context): string {
  if (!node.content) return ''
  return node.content.map((child) => renderNode(child, ctx)).join('')
}

function rawText(node: ContentNode): string {
  if (typeof node.text === 'string') return node.text
  if (!node.content) return ''
  return node.content.map(rawText).join('')
}

function renderMath(latex: string, display: boolean, ctx: Context): string {
  const rendered = ctx.options.renderMath?.(latex, display) ?? null
  const inner = rendered ?? `<span style="${S.mathSource}">${escapeHtml(latex)}</span>`
  return display ? `<div style="${S.mathBlock}">${inner}</div>` : inner
}

// A task item's first paragraph sits on the checkbox line; extra blocks follow.
function renderTaskItem(node: ContentNode, ctx: Context): string {
  const box = getAttr(node, 'checked') === true ? '☑' : '☐'
  const [first, ...rest] = node.content ?? []
  const lead =
    first?.type === 'paragraph' ? renderChildren(first, ctx) : first ? renderNode(first, ctx) : ''
  const tail = rest.map((child) => renderNode(child, ctx)).join('')
  return `<li style="${S.taskItem}">${box}&nbsp;${lead}${tail}</li>`
}

function renderNode(node: ContentNode, ctx: Context): string {
  switch (node.type) {
    case undefined:
    case 'doc':
      return renderChildren(node, ctx)

    case 'paragraph':
      return `<p style="${S.text}">${renderChildren(node, ctx)}</p>`

    case 'heading': {
      const raw = Number(getAttr(node, 'level') ?? 1)
      const level = Math.min(6, Math.max(1, Number.isFinite(raw) ? Math.round(raw) : 1))
      return `<h${level} style="${HEADING[level - 1]}">${renderChildren(node, ctx)}</h${level}>`
    }

    case 'text':
      return renderText(node)

    case 'hardBreak':
      return '<br>'

    case 'bulletList':
      return `<ul style="${S.list}">${renderChildren(node, ctx)}</ul>`

    case 'orderedList': {
      const start = Number(getAttr(node, 'start') ?? 1)
      const startAttr = Number.isFinite(start) && start !== 1 ? ` start="${Math.round(start)}"` : ''
      return `<ol${startAttr} style="${S.list}">${renderChildren(node, ctx)}</ol>`
    }

    case 'listItem':
      return `<li style="${S.li}">${renderChildren(node, ctx)}</li>`

    case 'taskList':
      return `<ul style="${S.taskList}">${renderChildren(node, ctx)}</ul>`

    case 'taskItem':
      return renderTaskItem(node, ctx)

    case 'blockquote':
      return `<blockquote style="${S.blockquote}">${renderChildren(node, ctx)}</blockquote>`

    case 'codeBlock':
      return `<pre style="${S.pre}"><code>${escapeHtml(rawText(node))}</code></pre>`

    case 'horizontalRule':
      return `<hr style="${S.hr}">`

    case 'image': {
      // Email clients won't load data: URIs; those images are rehosted before send.
      const src = sanitizeUrl(getAttr(node, 'src'))
      if (!src) return ''
      const alt = escapeHtml(String(getAttr(node, 'alt') ?? ''))
      const width = positiveInt(getAttr(node, 'width'))
      return `<img src="${escapeHtml(src)}" alt="${alt}"${width ? ` width="${Math.min(width, 600)}"` : ''} style="${S.img}">`
    }

    case 'youtube':
    case 'iframe': {
      const url = watchUrl(getAttr(node, 'src'), getAttr(node, 'start'))
      if (!url) return ''
      return `<p style="${S.text}"><a href="${escapeHtml(url)}" style="${S.button}">▶ Watch video</a></p>`
    }

    case 'math':
    case 'inlineMath':
      return renderMath(String(getAttr(node, 'latex') ?? ''), false, ctx)

    case 'blockMath':
      return renderMath(String(getAttr(node, 'latex') ?? ''), true, ctx)

    case 'callout': {
      const emoji = getAttr(node, 'emoji')
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="${S.callout}"><tr>${
        emoji
          ? `<td valign="top" style="width:28px;font-size:18px;line-height:1.6">${escapeHtml(String(emoji))}</td>`
          : ''
      }<td valign="top">${renderChildren(node, ctx)}</td></tr></table>`
    }

    case 'footnoteReference': {
      const number = ctx.footnoteNumbers.get(getAttr<string>(node, 'id') ?? '')
      return number ? `<sup style="${S.footnoteRef}">${number}</sup>` : ''
    }

    case 'footnotes': {
      const notes = (node.content ?? []).filter((note) =>
        ctx.footnoteNumbers.has(getAttr<string>(note, 'id') ?? '')
      )
      if (notes.length === 0) return ''
      return `<ol style="${S.footnotes}">${notes
        .map(
          (note) =>
            `<li style="margin:0 0 6px">${renderChildren(note, ctx).replaceAll(S.text, 'margin:0;font-size:14px;line-height:1.6;color:#444')}</li>`
        )
        .join('')}</ol>`
    }

    case 'table':
      return `<table cellpadding="0" cellspacing="0" style="${S.table}">${renderChildren(node, ctx)}</table>`

    case 'tableRow':
      return `<tr>${renderChildren(node, ctx)}</tr>`

    case 'tableHeader':
      return `<th${cellAttrs(node)} style="${S.th}">${renderChildren(node, ctx)}</th>`

    case 'tableCell':
      return `<td${cellAttrs(node)} style="${S.cell}">${renderChildren(node, ctx)}</td>`

    default:
      return renderChildren(node, ctx)
  }
}

export function renderToEmail(
  doc: ContentDoc | null | undefined,
  options: EmailRenderOptions = {}
): string {
  if (!doc) return ''
  return renderNode(doc, { options, footnoteNumbers: footnoteOrder(doc) })
}
