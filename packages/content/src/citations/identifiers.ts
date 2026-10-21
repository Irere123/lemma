// Recognise the identifiers people paste into the "Add citation" box.

export type IdentifierKind = 'doi' | 'arxiv' | 'isbn' | 'url'

export type Identifier = { kind: IdentifierKind; value: string }

const PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

/**
 * Drop punctuation that came from the surrounding prose rather than the
 * identifier: `10.1000/xyz.` or `(see https://x.org/a)`. Closing brackets are
 * kept when they balance an opening one inside the identifier, because DOIs
 * such as `10.1016/S0140-6736(20)30183-5` legitimately contain them.
 */
function stripTrailing(value: string): string {
  let out = value
  for (;;) {
    const last = out.at(-1)
    if (!last) return out
    if ('.,;:!?\'"”’>'.includes(last)) {
      out = out.slice(0, -1)
      continue
    }
    const open = PAIRS[last]
    if (open) {
      const opens = out.split(open).length - 1
      const closes = out.split(last).length - 1
      if (closes > opens) {
        out = out.slice(0, -1)
        continue
      }
    }
    return out
  }
}

function unwrap(input: string): string {
  return input
    .trim()
    .replace(/^[<"'“‘([]+/, '')
    .trim()
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const DOI_BODY = /^10\.\d{4,9}\/\S+$/

/**
 * The bare DOI (`10.xxxx/…`) from a bare DOI, a `doi:` prefix or a
 * doi.org / dx.doi.org URL; null when the input is not a DOI.
 */
export function cleanDoi(input: string): string | null {
  let value = unwrap(input)
  const url = /^(?:https?:\/\/)?(?:dx\.|www\.)?doi\.org\/(.+)$/i.exec(value)
  if (url) value = safeDecode(url[1]!.replace(/[?#].*$/, ''))
  else value = value.replace(/^(?:doi:\s*|info:doi\/)/i, '')
  value = stripTrailing(value.trim())
  return DOI_BODY.test(value) ? value : null
}

const ARXIV_NEW = /^(\d{2})(\d{2})\.(\d{4,5})(v\d+)?$/
const ARXIV_OLD = /^([a-z]+(?:-[a-z]+)*(?:\.[A-Z]{2})?)\/(\d{2})(\d{2})\d{3}(v\d+)?$/

function validArxivId(id: string): boolean {
  const modern = ARXIV_NEW.exec(id)
  if (modern) {
    const yymm = Number(modern[1]! + modern[2]!)
    const month = Number(modern[2])
    if (month < 1 || month > 12 || yymm < 704) return false
    // Four-digit sequence numbers until December 2014, five from January 2015.
    return modern[3]!.length === (yymm >= 1501 ? 5 : 4)
  }
  const legacy = ARXIV_OLD.exec(id)
  if (legacy) {
    const month = Number(legacy[3])
    return month >= 1 && month <= 12
  }
  return false
}

/** The arXiv id (keeping any `vN`) from an id, `arXiv:` prefix or arxiv.org URL. */
export function normalizeArxivId(input: string): string | null {
  let value = unwrap(input)
  const url =
    /^(?:https?:\/\/)?(?:www\.|export\.)?arxiv\.org\/(?:abs|pdf|html)\/([^?#]+?)(?:\.pdf)?\/?(?:[?#].*)?$/i.exec(
      value
    )
  if (url) value = url[1]!
  else value = value.replace(/^arxiv:\s*/i, '')
  value = stripTrailing(value)
  return validArxivId(value) ? value : null
}

/** An arXiv id without its version suffix (`2301.01234v2` → `2301.01234`). */
export function arxivBaseId(id: string): string {
  return id.replace(/v\d+$/, '')
}

function isbn10Valid(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < 10; i++) {
    const ch = digits[i]!
    const value = ch === 'X' ? 10 : Number(ch)
    if (ch === 'X' && i !== 9) return false
    sum += value * (10 - i)
  }
  return sum % 11 === 0
}

function isbn13CheckDigit(first12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 ? 3 : 1)
  return (10 - (sum % 10)) % 10
}

/** A checksum-validated ISBN-10 or ISBN-13, normalised to ISBN-13 digits. */
export function normalizeIsbn(input: string): string | null {
  const match = /^(?:isbn(?:-1[03])?:?\s*)?([0-9][0-9\s-]{8,20}[0-9Xx])$/i.exec(unwrap(input))
  if (!match) return null
  const digits = match[1]!.replace(/[\s-]/g, '').toUpperCase()
  if (digits.length === 10 && /^\d{9}[\dX]$/.test(digits)) {
    if (!isbn10Valid(digits)) return null
    const body = `978${digits.slice(0, 9)}`
    return `${body}${isbn13CheckDigit(body)}`
  }
  if (digits.length === 13 && /^97[89]\d{10}$/.test(digits)) {
    return isbn13CheckDigit(digits.slice(0, 12)) === Number(digits[12]) ? digits : null
  }
  return null
}

function normalizeUrl(input: string): string | null {
  const value = stripTrailing(unwrap(input))
  if (!/^https?:\/\/\S+$/i.test(value)) return null
  try {
    const url = new URL(value)
    return url.hostname ? value : null
  } catch {
    return null
  }
}

/**
 * Classify pasted text as a DOI, arXiv id, ISBN or web address. DOI and arXiv
 * URLs are recognised as such; other publisher URLs are returned as `url`.
 */
export function detectIdentifier(input: string): Identifier | null {
  const value = input.trim()
  if (!value || /\s/.test(value.replace(/^(?:doi|arxiv|isbn(?:-1[03])?):?\s+/i, ''))) {
    // Free text with spaces is never an identifier, except a spaced-out ISBN.
    const isbn = normalizeIsbn(value)
    return isbn ? { kind: 'isbn', value: isbn } : null
  }
  const doi = cleanDoi(value)
  if (doi) return { kind: 'doi', value: doi }
  const arxiv = normalizeArxivId(value)
  if (arxiv) return { kind: 'arxiv', value: arxiv }
  const isbn = normalizeIsbn(value)
  if (isbn) return { kind: 'isbn', value: isbn }
  const url = normalizeUrl(value)
  if (url) return { kind: 'url', value: url }
  return null
}
