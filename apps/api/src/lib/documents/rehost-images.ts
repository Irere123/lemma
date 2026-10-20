import { BODY_FIELD } from '@lemma/content/yjs'
import * as Y from 'yjs'

import type { CloudflareBindings } from '@api/env-runtime'
import { storage } from '@api/lib/storage'

// Images pasted into a document arrive inline (base64, from Google Docs and
// screenshots) or hotlinked from wherever they were copied. Both are copied
// into Lemma's own storage so documents stay small, published posts don't
// break when the source moves, and readers' browsers never call third parties.

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_PER_PASS = 8
const FETCH_TIMEOUT_MS = 10_000

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

// Sources already tried this lifetime that couldn't be fetched; not retried
// until the object restarts.
const failed = new Set<string>()

function* images(node: Y.XmlFragment | Y.XmlElement): Generator<Y.XmlElement> {
  for (const child of node.toArray()) {
    if (child instanceof Y.XmlElement) {
      if (child.nodeName === 'image') yield child
      else yield* images(child)
    }
  }
}

function needsRehost(src: unknown, assetBase: URL | null): src is string {
  if (typeof src !== 'string' || failed.has(src)) return false
  if (src.startsWith('data:image/')) return true
  if (!/^https?:\/\//i.test(src)) return false
  try {
    return !assetBase || new URL(src).host !== assetBase.host
  } catch {
    return false
  }
}

async function download(
  src: string
): Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string } | null> {
  if (src.startsWith('data:')) {
    const match = /^data:(image\/[\w.+-]+);base64,(.*)$/s.exec(src)
    if (!match?.[1] || !match[2]) return null
    const binary = atob(match[2])
    if (binary.length > MAX_IMAGE_BYTES) return null
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return { bytes, type: match[1] }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(src, { signal: controller.signal, redirect: 'follow' })
    const type =
      (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
    if (!response.ok || !EXTENSIONS[type]) return null
    const length = Number(response.headers.get('content-length') ?? 0)
    if (length > MAX_IMAGE_BYTES) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    return bytes.byteLength > MAX_IMAGE_BYTES ? null : { bytes, type }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function digest(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(hash.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Rehost up to MAX_PER_PASS images; returns how many were moved. */
export async function rehostImages(
  doc: Y.Doc,
  env: CloudflareBindings,
  documentId: string | null
): Promise<number> {
  if (!documentId || !env.R2_STORAGE_BASE_URL) return 0
  let assetBase: URL | null = null
  try {
    assetBase = new URL(env.R2_STORAGE_BASE_URL)
  } catch {
    assetBase = null
  }

  const pending: Y.XmlElement[] = []
  for (const image of images(doc.getXmlFragment(BODY_FIELD))) {
    if (needsRehost(image.getAttribute('src'), assetBase)) pending.push(image)
    if (pending.length >= MAX_PER_PASS) break
  }

  let moved = 0
  for (const image of pending) {
    const src = image.getAttribute('src') as string
    const file = await download(src)
    if (!file) {
      failed.add(src)
      continue
    }
    try {
      const key = `documents/${documentId}/${await digest(file.bytes)}.${EXTENSIONS[file.type] ?? 'img'}`
      const { url } = await storage.upload(key, new Blob([file.bytes], { type: file.type }), {
        contentType: file.type,
      })
      // The image may have been edited or deleted while we downloaded it.
      doc.transact(() => {
        if (!image._item?.deleted && image.getAttribute('src') === src)
          image.setAttribute('src', url)
      }, 'server')
      moved += 1
    } catch (error) {
      failed.add(src)
      console.error('rehostImages: upload failed', { documentId, error: String(error) })
    }
  }
  return moved
}
