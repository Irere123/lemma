import { youtubeVideoId } from '../render-html'
import { sanitizeUrl } from '../sanitize'
import type { ContentNode } from '../types'

// Small helpers shared by both exporters and their hand-written XML parts.

// XML 1.0 forbids most C0 controls, U+FFFE/U+FFFF and lone surrogates; text
// pasted from Word or a PDF can carry them, and one is enough to make a strict
// parser (Apple Books, Word) reject the whole file. Pairs are matched first so
// valid astral characters (emoji) survive.
const XML_UNSAFE =
  /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF￾￿]/g

export function xmlSafe(value: string): string {
  return value.replace(XML_UNSAFE, (match) => (match.length === 2 ? match : ''))
}

/** Escapes text for element content and double-quoted attribute values. */
export function escapeXml(value: unknown): string {
  return xmlSafe(String(value ?? ''))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n'

/** RFC 4122 v4. `crypto.randomUUID` needs a secure context; getRandomValues doesn't. */
export function randomUuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** `2026-10-21T09:30:00Z`: the form dcterms:modified requires (no milliseconds). */
export const isoSeconds = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z')

const W3CDTF = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/

/** A caller's ISO date as W3C-DTF (what dc:date accepts), or null if it isn't one. */
export function w3cDate(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (W3CDTF.test(trimmed)) return trimmed
  const time = Date.parse(trimmed)
  return Number.isNaN(time) ? null : isoSeconds(new Date(time))
}

export const positiveInt = (value: unknown): number | null => {
  const n = Number(value)
  return value !== null && value !== '' && Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/** The watch URL for a YouTube (or other web) embed; neither format can play one inline. */
export function videoUrl(node: ContentNode): string | null {
  const id = youtubeVideoId(node.attrs?.src)
  const start = positiveInt(node.attrs?.start)
  const url = id
    ? `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`
    : sanitizeUrl(node.attrs?.src)
  return url && /^https?:\/\//i.test(url) ? url : null
}

export function walk(node: ContentNode | null | undefined, visit: (node: ContentNode) => void) {
  if (!node) return
  visit(node)
  for (const child of node.content ?? []) walk(child, visit)
}
