import { escapeHtml, sanitizeUrl } from './render-html'
import type { ContentDoc, ContentMark, ContentNode } from './types'

// Email-safe renderer: inline styles only (clients strip CSS/JS); embeds degrade to links.

const S = {
  text: 'margin:0 0 16px;font-size:16px;line-height:1.7;color:#1a1a1a',
  h1: 'margin:32px 0 12px;font-size:26px;line-height:1.25;font-weight:700;color:#111',
  h2: 'margin:28px 0 10px;font-size:21px;line-height:1.3;font-weight:700;color:#111',
  h3: 'margin:22px 0 8px;font-size:18px;line-height:1.35;font-weight:700;color:#111',
  list: 'margin:0 0 16px;padding-left:24px;font-size:16px;line-height:1.7;color:#1a1a1a',
  li: 'margin:0 0 6px',
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
} as const

function getAttr<T = unknown>(node: ContentNode, key: string): T | undefined {
  return node.attrs?.[key] as T | undefined
}

function cellAttrs(node: ContentNode): string {
  const colspan = Number(getAttr(node, 'colspan') ?? 1)
  const rowspan = Number(getAttr(node, 'rowspan') ?? 1)
  let out = ''
  if (Number.isFinite(colspan) && colspan > 1) out += ` colspan="${colspan}"`
  if (Number.isFinite(rowspan) && rowspan > 1) out += ` rowspan="${rowspan}"`
  return out
}

function watchUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const embed = /youtube\.com\/embed\/([\w-]+)/.exec(raw)
  if (embed) return `https://www.youtube.com/watch?v=${embed[1]}`
  return sanitizeUrl(raw)
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
    case 'code':
      return `<code style="${S.code}">`
    case 'link': {
      const href = sanitizeUrl(mark.attrs?.href)
      return href ? `<a href="${escapeHtml(href)}" style="${S.link}">` : '<span>'
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

function renderChildren(node: ContentNode): string {
  if (!node.content) return ''
  return node.content.map(renderNode).join('')
}

function rawText(node: ContentNode): string {
  if (typeof node.text === 'string') return node.text
  if (!node.content) return ''
  return node.content.map(rawText).join('')
}

function renderNode(node: ContentNode): string {
  switch (node.type) {
    case undefined:
    case 'doc':
      return renderChildren(node)

    case 'paragraph':
      return `<p style="${S.text}">${renderChildren(node)}</p>`

    case 'heading': {
      const raw = Number(getAttr(node, 'level') ?? 1)
      const level = Math.min(3, Math.max(1, Number.isFinite(raw) ? raw : 1))
      const style = level === 1 ? S.h1 : level === 2 ? S.h2 : S.h3
      return `<h${level} style="${style}">${renderChildren(node)}</h${level}>`
    }

    case 'text':
      return renderText(node)

    case 'hardBreak':
      return '<br>'

    case 'bulletList':
      return `<ul style="${S.list}">${renderChildren(node)}</ul>`

    case 'orderedList':
      return `<ol style="${S.list}">${renderChildren(node)}</ol>`

    case 'listItem':
      return `<li style="${S.li}">${renderChildren(node)}</li>`

    case 'taskList':
      return `<ul style="${S.list};list-style:none;padding-left:0">${renderChildren(node)}</ul>`

    case 'taskItem': {
      const checked = getAttr(node, 'checked') === true
      return `<li style="${S.li}">${checked ? '☑' : '☐'} ${renderChildren(node)}</li>`
    }

    case 'blockquote':
      return `<blockquote style="${S.blockquote}">${renderChildren(node)}</blockquote>`

    case 'codeBlock':
      return `<pre style="${S.pre}"><code>${escapeHtml(rawText(node))}</code></pre>`

    case 'horizontalRule':
      return `<hr style="${S.hr}">`

    case 'image': {
      const src = sanitizeUrl(getAttr(node, 'src'), { allowData: true })
      if (!src) return ''
      const alt = escapeHtml(String(getAttr(node, 'alt') ?? ''))
      return `<img src="${escapeHtml(src)}" alt="${alt}" style="${S.img}">`
    }

    case 'youtube':
    case 'iframe': {
      const url = watchUrl(getAttr(node, 'src'))
      if (!url) return ''
      return `<p style="${S.text}"><a href="${escapeHtml(url)}" style="${S.button}">▶ Watch video</a></p>`
    }

    case 'math':
      return `<span style="font-family:monospace">${escapeHtml(String(getAttr(node, 'latex') ?? ''))}</span>`

    case 'callout':
      return `<div style="${S.callout}">${getAttr(node, 'emoji') ? `${escapeHtml(String(getAttr(node, 'emoji')))} ` : ''}${renderChildren(node)}</div>`

    case 'table':
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="${S.table}">${renderChildren(node)}</table>`

    case 'tableRow':
      return `<tr>${renderChildren(node)}</tr>`

    case 'tableHeader':
      return `<th${cellAttrs(node)} style="${S.th}">${renderChildren(node)}</th>`

    case 'tableCell':
      return `<td${cellAttrs(node)} style="${S.cell}">${renderChildren(node)}</td>`

    default:
      return renderChildren(node)
  }
}

export function renderToEmail(doc: ContentDoc | null | undefined): string {
  if (!doc) return ''
  return renderNode(doc)
}
