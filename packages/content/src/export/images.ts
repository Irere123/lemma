import type { ExportImage, FetchImage } from './types'

export type ImageSize = { width: number; height: number }

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
}

export const imageExtension = (mediaType: string) => EXTENSIONS[mediaType] ?? 'bin'

const startsWith = (data: Uint8Array, bytes: number[], at = 0) =>
  bytes.every((byte, index) => data[at + index] === byte)

const ascii = (data: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...data.subarray(at, at + length))

/** The real type from the file's magic bytes; servers and callers often get it wrong. */
export function sniffImageType(data: Uint8Array): string | null {
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(data, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (ascii(data, 0, 4) === 'GIF8') return 'image/gif'
  if (ascii(data, 0, 4) === 'RIFF' && ascii(data, 8, 4) === 'WEBP') return 'image/webp'
  if (ascii(data, 4, 4) === 'ftyp' && /^avi[fs]$/.test(ascii(data, 8, 4))) return 'image/avif'
  const head = new TextDecoder().decode(data.subarray(0, 1024))
  if (/^﻿?\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) {
    return 'image/svg+xml'
  }
  return null
}

/** Trusts the bytes over the declared type, and normalises the type's spelling. */
export function normalizeImage(image: ExportImage): ExportImage {
  const declared = (image.mediaType.split(';')[0] ?? '').trim().toLowerCase()
  const mediaType =
    sniffImageType(image.data) ?? (declared === 'image/jpg' ? 'image/jpeg' : declared)
  return { data: image.data, mediaType }
}

const u16be = (data: Uint8Array, at: number) => ((data[at] ?? 0) << 8) | (data[at + 1] ?? 0)
const u16le = (data: Uint8Array, at: number) => (data[at] ?? 0) | ((data[at + 1] ?? 0) << 8)
const u24le = (data: Uint8Array, at: number) => u16le(data, at) | ((data[at + 2] ?? 0) << 16)
const u32be = (data: Uint8Array, at: number) => u16be(data, at) * 0x10000 + u16be(data, at + 2)

function jpegSize(data: Uint8Array): ImageSize | null {
  let at = 2
  while (at + 9 < data.length) {
    if (data[at] !== 0xff) return null
    const marker = data[at + 1] ?? 0
    if (marker === 0xff) {
      at += 1 // fill byte
      continue
    }
    // Standalone markers carry no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      at += 2
      continue
    }
    // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: u16be(data, at + 5), width: u16be(data, at + 7) }
    }
    at += 2 + u16be(data, at + 2)
  }
  return null
}

function webpSize(data: Uint8Array): ImageSize | null {
  const chunk = ascii(data, 12, 4)
  if (chunk === 'VP8 ') return { width: u16le(data, 26) & 0x3fff, height: u16le(data, 28) & 0x3fff }
  if (chunk === 'VP8L') {
    const b0 = data[21] ?? 0
    const b1 = data[22] ?? 0
    const b2 = data[23] ?? 0
    const b3 = data[24] ?? 0
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    }
  }
  if (chunk === 'VP8X') return { width: 1 + u24le(data, 24), height: 1 + u24le(data, 27) }
  return null
}

function svgSize(data: Uint8Array): ImageSize | null {
  const head = new TextDecoder().decode(data.subarray(0, 4096))
  const tag = /<svg\b[^>]*>/i.exec(head)?.[0]
  if (!tag) return null
  const attribute = (name: string) =>
    new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1]?.trim()
  // Percentages and ems have no intrinsic size; plain numbers and px do.
  const length = (value: string | undefined) => {
    const match = value ? /^([\d.]+)(px)?$/.exec(value) : null
    const n = match ? Number(match[1]) : Number.NaN
    return n > 0 ? n : null
  }
  const width = length(attribute('width'))
  const height = length(attribute('height'))
  if (width && height) return { width, height }
  const box = attribute('viewBox')
    ?.split(/[\s,]+/)
    .map(Number)
  if (box?.length === 4 && (box[2] ?? 0) > 0 && (box[3] ?? 0) > 0) {
    const ratio = (box[3] ?? 1) / (box[2] ?? 1)
    if (width) return { width, height: width * ratio }
    if (height) return { width: height / ratio, height }
    return { width: box[2] ?? 0, height: box[3] ?? 0 }
  }
  return null
}

/** Intrinsic size in pixels, read from the file header. */
export function imageSize(image: ExportImage): ImageSize | null {
  const { data } = image
  let size: ImageSize | null = null
  switch (image.mediaType) {
    case 'image/png':
      size = data.length >= 24 ? { width: u32be(data, 16), height: u32be(data, 20) } : null
      break
    case 'image/gif':
      size = data.length >= 10 ? { width: u16le(data, 6), height: u16le(data, 8) } : null
      break
    case 'image/jpeg':
      size = jpegSize(data)
      break
    case 'image/webp':
      size = webpSize(data)
      break
    case 'image/svg+xml':
      size = svgSize(data)
      break
  }
  return size && size.width > 0 && size.height > 0 ? size : null
}

/** Decodes a `data:` URL (base64 or percent-encoded) into bytes. */
export function decodeDataUrl(src: string): ExportImage | null {
  const match = /^data:([^,]*?),([\s\S]*)$/i.exec(src.trim())
  if (!match) return null
  const meta = (match[1] ?? '').split(';')
  const mediaType = (meta[0] || 'text/plain').trim().toLowerCase()
  const body = match[2] ?? ''
  try {
    if (meta.some((part) => part.trim().toLowerCase() === 'base64')) {
      const binary = atob(body.replace(/\s+/g, ''))
      const data = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i)
      return { data, mediaType }
    }
    return { data: new TextEncoder().encode(decodeURIComponent(body)), mediaType }
  } catch {
    return null
  }
}

/**
 * Loads every image once: data URLs are decoded in place, anything else goes
 * through `fetchImage` (a few at a time). Failures resolve to null.
 */
export async function loadImages(
  sources: Iterable<string>,
  fetchImage: FetchImage | undefined,
  concurrency = 6
): Promise<Map<string, ExportImage | null>> {
  const results = new Map<string, ExportImage | null>()
  const queue = [...new Set(sources)]
  const load = async (src: string): Promise<ExportImage | null> => {
    const inline = src.startsWith('data:') ? decodeDataUrl(src) : null
    if (inline) return normalizeImage(inline)
    if (!fetchImage) return null
    try {
      const image = await fetchImage(src)
      return image && image.data.length > 0 ? normalizeImage(image) : null
    } catch {
      return null
    }
  }
  const worker = async () => {
    for (let src = queue.shift(); src !== undefined; src = queue.shift()) {
      results.set(src, await load(src))
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker))
  return results
}
