import { BLOCK_ID_PATTERN } from './ids'
import { equationNumber, type Numbering, numberingOf } from './numbering'
import { escapeHtml, safeCssColor, sanitizeUrl } from './sanitize'
import type { ContentDoc, ContentMark, ContentNode } from './types'

export { escapeHtml, sanitizeUrl }

/**
 * DOM-free JSON → HTML renderer for published pages (runs in the Worker).
 * Safe by construction: text is escaped, URLs and colours are allowlisted.
 *
 * Output is plain semantic HTML styled by `.writer-prose` in the web app, and
 * it uses the same markup the editor's parse rules accept, so a published post
 * pasted back into the editor keeps its callouts, task lists, math and embeds.
 * Covered by the parity tests in `test/parity.test.ts`.
 */

export type RenderOptions = {
  /** Render TeX to HTML (KaTeX in the API). Without it, the TeX source is shown. */
  renderMath?: (latex: string, displayMode: boolean) => string | null
  /**
   * Syntax-highlight a code block (lowlight in the API), returning safe HTML
   * for the inside of its <code>, or null to show it plain.
   */
  highlightCode?: (code: string, language: string) => string | null
  /**
   * Formatted citations (from a citation processor over `citationClusters(doc)`):
   * one entry per citation node in reading order, plus the bibliography.
   */
  citations?: RenderedCitations
  /**
   * Where a link to another document goes, or null to show its title as plain
   * text (e.g. the target is private). Without it, links render as text.
   */
  documentLink?: (link: { documentId: string; blockId: string | null; title: string }) => {
    href: string
    title: string
  } | null
}

export type RenderedCitations = {
  clusters: { html: string; text: string }[]
  bibliography: { id: string; html: string; text: string; number?: number }[]
  /** Numeric styles list the bibliography as an ordered list. */
  numeric?: boolean
}

type Context = {
  options: RenderOptions
  footnoteNumbers: Map<string, number>
  numbering: Numbering
  citationIndex: { next: number }
}

function attr(name: string, value: unknown): string {
  if (value === null || value === undefined || value === false) return ''
  if (value === true) return ` ${name}`
  return ` ${name}="${escapeHtml(String(value))}"`
}

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
  // One entry per spanned column; a column nobody resized is stored as 0.
  const colwidth = Array.isArray(widths) ? widths.map((w) => positiveInt(w) ?? 0) : []
  return (
    (colspan && colspan > 1 ? attr('colspan', colspan) : '') +
    (rowspan && rowspan > 1 ? attr('rowspan', rowspan) : '') +
    (colwidth.some((w) => w > 0) ? attr('colwidth', colwidth.join(',')) : '')
  )
}

// Column widths live on the cells of the first row (ProseMirror's model); the
// browser needs them on a <colgroup>.
function colgroup(table: ContentNode): string {
  const firstRow = table.content?.[0]
  if (!firstRow?.content) return ''
  const cols: (number | null)[] = []
  for (const cell of firstRow.content) {
    const span = positiveInt(getAttr(cell, 'colspan')) ?? 1
    const widths = getAttr<unknown[]>(cell, 'colwidth')
    for (let i = 0; i < span; i++) {
      cols.push(Array.isArray(widths) ? positiveInt(widths[i]) : null)
    }
  }
  if (!cols.some((w) => w !== null)) return ''
  const body = cols.map((w) => (w ? `<col style="width:${w}px">` : '<col>')).join('')
  return `<colgroup>${body}</colgroup>`
}

// Mirror ProseMirror's TableView: fixed width only when every column has one.
function tableWidth(table: ContentNode): string {
  const firstRow = table.content?.[0]
  if (!firstRow?.content) return ''
  let total = 0
  for (const cell of firstRow.content) {
    const span = positiveInt(getAttr(cell, 'colspan')) ?? 1
    const widths = getAttr<unknown[]>(cell, 'colwidth')
    for (let i = 0; i < span; i++) {
      const w = Array.isArray(widths) ? positiveInt(widths[i]) : null
      if (!w) return ''
      total += w
    }
  }
  return total > 0 ? ` style="width:${total}px"` : ''
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
      return '<code>'
    case 'link': {
      const href = sanitizeUrl(mark.attrs?.href)
      if (!href) return '<span>'
      const external = !href.startsWith('#')
      return `<a href="${escapeHtml(href)}"${attr('title', mark.attrs?.title)}${
        external ? ' rel="noopener noreferrer nofollow" target="_blank"' : ''
      }>`
    }
    case 'highlight': {
      const color = safeCssColor(mark.attrs?.color)
      return color
        ? `<mark data-color="${escapeHtml(color)}" style="background-color:${color}">`
        : '<mark>'
    }
    case 'textStyle': {
      // data-color keeps the stored value exactly; browsers rewrite style colours.
      const color = safeCssColor(mark.attrs?.color)
      return color ? `<span data-color="${escapeHtml(color)}" style="color:${color}">` : '<span>'
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

// Marks apply to any inline node: bold math, a linked footnote reference, a
// hard break typed while italic is on.
function withMarks(node: ContentNode, inner: string): string {
  const marks = node.marks ?? []
  if (marks.length === 0) return inner

  let open = ''
  let close = ''
  for (const mark of marks) {
    open += openMark(mark)
    close = closeMark(mark) + close
  }
  return open + inner + close
}

const hasLink = (node: ContentNode) =>
  (node.marks ?? []).some((mark) => mark.type === 'link' && sanitizeUrl(mark.attrs?.href))

function rawText(node: ContentNode): string {
  if (typeof node.text === 'string') return node.text
  if (!node.content) return ''
  return node.content.map(rawText).join('')
}

/** The video id of every URL shape the YouTube extension accepts. */
export function youtubeVideoId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const url = raw.trim()
  return (
    /youtube(?:-nocookie)?\.com\/(?:embed|shorts|live|v)\/([\w-]+)/.exec(url)?.[1] ??
    /[?&]v=([\w-]+)/.exec(url)?.[1] ??
    /youtu\.be\/([\w-]+)/.exec(url)?.[1] ??
    null
  )
}

function youtubeEmbedUrl(raw: unknown, start: unknown): string | null {
  const id = youtubeVideoId(raw)
  if (!id) return null
  const seconds = positiveInt(start)
  return `https://www.youtube-nocookie.com/embed/${id}${seconds ? `?start=${seconds}` : ''}`
}

function renderMath(latex: string, display: boolean, ctx: Context): string {
  const rendered = ctx.options.renderMath?.(latex, display) ?? null
  const inner = rendered ?? escapeHtml(latex)
  return display
    ? `<div data-type="block-math" data-latex="${escapeHtml(latex)}" class="math-block">${inner}</div>`
    : `<span data-type="inline-math" data-latex="${escapeHtml(latex)}" class="math-inline">${inner}</span>`
}

/** Footnote numbers by first reference, in reading order. */
export function footnoteOrder(doc: ContentNode): Map<string, number> {
  const order = new Map<string, number>()
  const walk = (node: ContentNode) => {
    if (node.type === 'footnotes') return
    if (node.type === 'footnoteReference') {
      const id = getAttr<string>(node, 'id')
      if (id && !order.has(id)) order.set(id, order.size + 1)
      return
    }
    node.content?.forEach(walk)
  }
  walk(doc)
  return order
}

const anchorId = (id: string) => escapeHtml(id.replace(/[^\w-]/g, ''))

/**
 * A block's stable id as its HTML id, so any paragraph, heading or figure of
 * a published post can be linked to (#id) and cross-references can point at
 * it. Not read back on import: a copy is a new block.
 */
function idAttr(node: ContentNode): string {
  const id = getAttr(node, 'id')
  return typeof id === 'string' && BLOCK_ID_PATTERN.test(id) ? ` id="${id}"` : ''
}

function renderChildren(node: ContentNode, ctx: Context): string {
  if (!node.content) return ''
  return node.content.map((child) => renderNode(child, ctx)).join('')
}

function renderNode(node: ContentNode, ctx: Context): string {
  switch (node.type) {
    case undefined:
    case 'doc':
      return renderChildren(node, ctx)

    case 'paragraph':
      return `<p${idAttr(node)}>${renderChildren(node, ctx)}</p>`

    case 'heading': {
      const raw = Number(getAttr(node, 'level') ?? 1)
      const level = Math.min(6, Math.max(1, Number.isFinite(raw) ? Math.round(raw) : 1))
      return `<h${level}${idAttr(node)}>${renderChildren(node, ctx)}</h${level}>`
    }

    case 'text':
      return withMarks(node, escapeHtml(node.text ?? ''))

    case 'hardBreak':
      return withMarks(node, '<br>')

    case 'bulletList':
      return `<ul>${renderChildren(node, ctx)}</ul>`

    case 'orderedList': {
      const start = Number(getAttr(node, 'start') ?? 1)
      const startAttr =
        Number.isFinite(start) && start !== 1 ? attr('start', Math.round(start)) : ''
      const type = getAttr(node, 'type')
      const typeAttr = typeof type === 'string' && /^[1aAiI]$/.test(type) ? attr('type', type) : ''
      return `<ol${startAttr}${typeAttr}>${renderChildren(node, ctx)}</ol>`
    }

    case 'listItem':
      return `<li${idAttr(node)}>${renderChildren(node, ctx)}</li>`

    case 'taskList':
      return `<ul data-type="taskList">${renderChildren(node, ctx)}</ul>`

    case 'taskItem': {
      const checked = getAttr(node, 'checked') === true
      return `<li${idAttr(node)} data-type="taskItem" data-checked="${checked}"><label><input type="checkbox" disabled${
        checked ? ' checked' : ''
      }></label><div>${renderChildren(node, ctx)}</div></li>`
    }

    case 'blockquote':
      return `<blockquote${idAttr(node)}>${renderChildren(node, ctx)}</blockquote>`

    case 'codeBlock': {
      const language = getAttr<string>(node, 'language')
      const langClass = language ? ` class="language-${escapeHtml(language)}"` : ''
      const code = rawText(node)
      const highlighted = language ? ctx.options.highlightCode?.(code, language) : null
      return `<pre${idAttr(node)}><code${langClass}>${highlighted ?? escapeHtml(code)}</code></pre>`
    }

    case 'horizontalRule':
      return `<hr${idAttr(node)}>`

    case 'image': {
      const src = sanitizeUrl(getAttr(node, 'src'), { allowData: true })
      if (!src) return ''
      const width = positiveInt(getAttr(node, 'width'))
      const height = positiveInt(getAttr(node, 'height'))
      return `<img${idAttr(node)} src="${escapeHtml(src)}"${attr('alt', getAttr(node, 'alt') ?? '')}${attr(
        'title',
        getAttr(node, 'title')
      )}${width ? attr('width', width) : ''}${height ? attr('height', height) : ''} loading="lazy" decoding="async">`
    }

    case 'youtube':
    case 'iframe': {
      const src = getAttr(node, 'src')
      const start = positiveInt(getAttr(node, 'start'))
      const embed = youtubeEmbedUrl(src, start)
      if (!embed) return ''
      const width = positiveInt(getAttr(node, 'width')) ?? 640
      const height = positiveInt(getAttr(node, 'height')) ?? 480
      return `<div${idAttr(node)} data-youtube-video class="embed-video"${attr('data-src', src)}${start ? attr('data-start', start) : ''}><iframe src="${escapeHtml(embed)}" width="${width}" height="${height}" frameborder="0" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
    }

    case 'math':
    case 'inlineMath':
      return withMarks(node, renderMath(String(getAttr(node, 'latex') ?? ''), false, ctx))

    case 'blockMath': {
      const number = equationNumber(ctx.numbering, node)
      const html = renderMath(String(getAttr(node, 'latex') ?? ''), true, ctx)
      if (!number) return html.replace(/^<div/, `<div${idAttr(node)}`)
      const tag = getAttr(node, 'tag')
      return html
        .replace(
          /^<div([^>]*) class="math-block">/,
          `<div${idAttr(node)}$1 data-numbered="true"${attr('data-tag', typeof tag === 'string' && tag ? tag : null)} class="math-block math-numbered">`
        )
        .replace(/<\/div>$/, `<span class="equation-number">${escapeHtml(number)}</span></div>`)
    }

    case 'figure': {
      const target = ctx.numbering.of(node)
      const [body, caption] = [node.content?.[0], node.content?.[1]]
      const label = target ? `<span class="figure-label">${escapeHtml(target.label)}.</span>` : ''
      const captionText = caption ? renderChildren(caption, ctx) : ''
      const figcaption = `<figcaption>${label}${
        captionText ? ` <span class="figure-caption">${captionText}</span>` : ''
      }</figcaption>`
      const inner = body ? renderNode(body, ctx) : ''
      // Table captions go above the table, figure captions below.
      const isTable = body?.type === 'table'
      return `<figure${idAttr(node)} data-figure class="figure${isTable ? ' figure-table' : ''}">${
        isTable ? figcaption + inner : inner + figcaption
      }</figure>`
    }

    case 'figcaption':
      return renderChildren(node, ctx)

    case 'citation': {
      const index = ctx.citationIndex.next++
      const items = getAttr(node, 'items')
      const mode = getAttr(node, 'mode')
      const data = `${attr('data-items', JSON.stringify(Array.isArray(items) ? items : []))}${
        mode === 'suppress-author' || mode === 'author-in-text' ? attr('data-mode', mode) : ''
      }`
      const rendered = ctx.options.citations?.clusters[index]
      const first = Array.isArray(items) ? (items[0] as { id?: unknown } | undefined)?.id : null
      const inner = rendered?.html ?? '(citation)'
      const linked =
        rendered && typeof first === 'string' && !hasLink(node)
          ? `<a href="#ref-${anchorId(first)}">${inner}</a>`
          : inner
      return `<span class="citation" data-citation${data}>${linked}</span>`
    }

    case 'bibliography': {
      const title = String(getAttr(node, 'title') ?? 'References')
      const entries = ctx.options.citations?.bibliography ?? []
      const list = ctx.options.citations?.numeric ? 'ol' : 'ul'
      const items = entries
        .map((entry) => `<li id="ref-${anchorId(entry.id)}">${entry.html}</li>`)
        .join('')
      return `<section${idAttr(node)} class="bibliography" data-bibliography${attr('data-title', title)}><h2>${escapeHtml(
        title
      )}</h2>${items ? `<${list} class="references">${items}</${list}>` : ''}</section>`
    }

    case 'crossReference': {
      const targetId = String(getAttr(node, 'target') ?? '')
      const target = ctx.numbering.targets.get(targetId)
      if (!target) {
        return `<a data-cross-ref${attr('data-target', targetId || null)} class="cross-ref cross-ref-missing">(missing reference)</a>`
      }
      const href =
        target.kind === 'footnote' ? `#fn-${anchorId(targetId)}` : `#${anchorId(targetId)}`
      return `<a data-cross-ref data-target="${escapeHtml(targetId)}" href="${href}" class="cross-ref">${escapeHtml(
        target.label
      )}</a>`
    }

    case 'documentLink': {
      const documentId = getAttr(node, 'documentId')
      const blockId = getAttr(node, 'blockId')
      const title = String(getAttr(node, 'title') ?? '')
      const resolved =
        typeof documentId === 'string' && documentId
          ? (ctx.options.documentLink?.({
              documentId,
              blockId: typeof blockId === 'string' && blockId ? blockId : null,
              title,
            }) ?? null)
          : null
      const href = resolved ? sanitizeUrl(resolved.href) : null
      const shown = escapeHtml(resolved?.title || title || 'Untitled')
      // A link inside a link can't be an <a>; an unresolved one (e.g. a
      // private note) shows its title only, without its id.
      if (!resolved || !href || hasLink(node)) {
        return withMarks(node, `<span class="document-link">${shown}</span>`)
      }
      return withMarks(
        node,
        `<a href="${escapeHtml(href)}" class="document-link" data-document-link data-document-id="${escapeHtml(
          documentId as string
        )}"${typeof blockId === 'string' && blockId ? attr('data-block-id', blockId) : ''}${attr(
          'data-title',
          resolved.title
        )}>${shown}</a>`
      )
    }

    case 'callout': {
      const emoji = escapeHtml(String(getAttr(node, 'emoji') ?? '💡'))
      return `<div${idAttr(node)} class="callout" data-callout data-emoji="${emoji}"><span class="callout-icon" aria-hidden="true">${emoji}</span><div class="callout-body">${renderChildren(node, ctx)}</div></div>`
    }

    case 'footnoteReference': {
      const id = getAttr<string>(node, 'id') ?? ''
      const number = ctx.footnoteNumbers.get(id)
      if (!number) return ''
      // Inside a link the number can't be a second <a> (HTML forbids nesting).
      const label = hasLink(node)
        ? String(number)
        : `<a href="#fn-${anchorId(id)}" id="fnref-${anchorId(id)}">${number}</a>`
      return withMarks(
        node,
        `<sup class="footnote-ref" data-footnote-ref data-id="${escapeHtml(id)}">${label}</sup>`
      )
    }

    case 'footnotes': {
      const notes = (node.content ?? []).filter((note) =>
        ctx.footnoteNumbers.has(getAttr<string>(note, 'id') ?? '')
      )
      if (notes.length === 0) return ''
      return `<section class="footnotes"><ol data-footnotes>${notes
        .map((note) => renderNode(note, ctx))
        .join('')}</ol></section>`
    }

    case 'footnote': {
      const id = getAttr<string>(node, 'id') ?? ''
      const backref = `<a href="#fnref-${anchorId(id)}" class="footnote-backref" data-footnote-backref aria-label="Back to text">↩</a>`
      const body = renderChildren(node, ctx)
      // Put the back-link inside the last paragraph so it doesn't add a line.
      const withBackref = body.endsWith('</p>')
        ? `${body.slice(0, -4)}${backref}</p>`
        : body + backref
      return `<li data-footnote-id="${escapeHtml(id)}" id="fn-${anchorId(id)}">${withBackref}</li>`
    }

    case 'table':
      return `<div${idAttr(node)} class="table-wrap"><table${tableWidth(node)}>${colgroup(node)}<tbody>${renderChildren(node, ctx)}</tbody></table></div>`

    case 'tableRow':
      return `<tr>${renderChildren(node, ctx)}</tr>`

    case 'tableHeader':
      return `<th${cellAttrs(node)}>${renderChildren(node, ctx)}</th>`

    case 'tableCell':
      return `<td${cellAttrs(node)}>${renderChildren(node, ctx)}</td>`

    default:
      // Unknown node: render children so future block types degrade gracefully.
      return renderChildren(node, ctx)
  }
}

export function renderToHTML(
  doc: ContentDoc | null | undefined,
  options: RenderOptions = {}
): string {
  if (!doc) return ''
  return renderNode(doc, {
    options,
    footnoteNumbers: footnoteOrder(doc),
    numbering: numberingOf(doc),
    citationIndex: { next: 0 },
  })
}
