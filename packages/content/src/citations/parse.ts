import { parseBibTeX } from './bibtex'
import { makeCiteKey } from './citekey'
import { type CslItem, normalizeItem, type ParseResult } from './csl'
import { parseRIS } from './ris'
import { isRecord } from './util'

export type LibraryFormat = 'bibtex' | 'ris' | 'csl-json' | 'unknown'

/** Parse CSL-JSON (an array of items or `{ items: [...] }`); ids are made unique. */
export function parseCslJson(text: string): ParseResult {
  const warnings: string[] = []
  let data: unknown
  try {
    data = JSON.parse(text.replace(/^﻿/, ''))
  } catch (error) {
    return { items: [], warnings: [`Invalid JSON: ${(error as Error).message}`] }
  }
  const list: unknown[] = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.items)
      ? data.items
      : isRecord(data) && (data.type || data.title)
        ? [data]
        : []
  if (!list.length && !Array.isArray(data)) {
    warnings.push('Expected an array of CSL-JSON items or an object with an "items" array')
  }

  const items: CslItem[] = []
  const taken = new Set<string>()
  list.forEach((raw, index) => {
    if (!isRecord(raw)) {
      warnings.push(`Item ${index + 1}: not an object, skipped`)
      return
    }
    const item = normalizeItem(raw)
    if (!item.id || taken.has(item.id)) {
      const previous = item.id
      item.id = makeCiteKey(item, taken)
      warnings.push(
        previous
          ? `Item ${index + 1}: duplicate id "${previous}" renamed to "${item.id}"`
          : `Item ${index + 1}: missing id, using "${item.id}"`
      )
    } else {
      taken.add(item.id)
    }
    items.push(item)
  })
  return { items, warnings }
}

function detectFormat(text: string, filename?: string): LibraryFormat {
  const ext = filename?.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  if (ext === 'bib' || ext === 'bibtex' || ext === 'biblatex') return 'bibtex'
  if (ext === 'ris') return 'ris'
  if (ext === 'json' || ext === 'csljson') return 'csl-json'

  const head = text.replace(/^﻿/, '').trimStart()
  if (head.startsWith('[') || head.startsWith('{')) return 'csl-json'
  if (/^TY {2}- /m.test(head.slice(0, 4096))) return 'ris'
  if (/@[a-z]+\s*[{(]/i.test(head)) return 'bibtex'
  return 'unknown'
}

/**
 * Parse a reference library, detecting its format from the file extension
 * or, failing that, from the content.
 */
export function parseLibrary(
  text: string,
  filename?: string
): { format: LibraryFormat; items: CslItem[]; warnings: string[] } {
  const format = detectFormat(text, filename)
  switch (format) {
    case 'bibtex':
      return { format, ...parseBibTeX(text) }
    case 'ris':
      return { format, ...parseRIS(text) }
    case 'csl-json':
      return { format, ...parseCslJson(text) }
    default:
      return {
        format,
        items: [],
        warnings: ['Unrecognised file: expected BibTeX (.bib), RIS (.ris) or CSL-JSON (.json)'],
      }
  }
}
