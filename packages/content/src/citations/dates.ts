import type { CslDate } from './csl'

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const MONTH_LOOKUP = new Map<string, number>()
MONTH_NAMES.forEach((name, i) => {
  MONTH_LOOKUP.set(name.toLowerCase(), i + 1)
  MONTH_LOOKUP.set(name.slice(0, 3).toLowerCase(), i + 1)
})
MONTH_LOOKUP.set('sept', 9)

/** `jan`, `Jan.`, `January`, `3` and `03` all give 3; anything else gives undefined. */
export function monthFromString(value: string): number | undefined {
  const v = value.trim().replace(/\.$/, '').toLowerCase()
  if (/^\d{1,2}$/.test(v)) {
    const n = Number(v)
    return n >= 1 && n <= 12 ? n : undefined
  }
  return MONTH_LOOKUP.get(v)
}

function validParts(year: number, month?: number, day?: number): number[] | null {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return null
  if (month === undefined) return [year]
  if (!(month >= 1 && month <= 12)) return [year]
  if (day === undefined || !(day >= 1 && day <= 31)) return [year, month]
  return [year, month, day]
}

const NO_DATE = /^(n\.?\s?d\.?|no date|undated|s\.?\s?d\.?)$/i
const MONTH_WORD =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?'
// ISO-ish numeric dates, as written by BibTeX `date`, RIS `PY`/`DA` (2020/03/15/),
// HTML meta tags (2020/03/15) and Atom feeds (2020-03-15T10:00:00Z).
const ISO = /^(\d{4})(?:[-/.](\d{1,2})(?:[-/.](\d{1,2}))?)?(?=$|[T\s/]|[-/.]?$)/
const MONTH_DAY_YEAR = new RegExp(
  `^${MONTH_WORD}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`,
  'i'
)
const DAY_MONTH_YEAR = new RegExp(
  `^(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_WORD},?\\s+(\\d{4})\\b`,
  'i'
)
const MONTH_YEAR = new RegExp(`^${MONTH_WORD},?\\s+(\\d{4})\\b`, 'i')
const YEAR_MONTH_DAY = new RegExp(`^(\\d{4})\\s+${MONTH_WORD}(?:\\s+(\\d{1,2}))?\\b`, 'i')

function parseSingle(value: string): number[] | null {
  let m = ISO.exec(value)
  if (m) {
    return validParts(
      Number(m[1]),
      m[2] ? Number(m[2]) : undefined,
      m[3] ? Number(m[3]) : undefined
    )
  }
  if ((m = MONTH_DAY_YEAR.exec(value))) {
    return validParts(Number(m[3]), monthFromString(m[1]!), Number(m[2]))
  }
  if ((m = DAY_MONTH_YEAR.exec(value))) {
    return validParts(Number(m[3]), monthFromString(m[2]!), Number(m[1]))
  }
  if ((m = MONTH_YEAR.exec(value))) {
    return validParts(Number(m[2]), monthFromString(m[1]!))
  }
  if ((m = YEAR_MONTH_DAY.exec(value))) {
    return validParts(Number(m[1]), monthFromString(m[2]!), m[3] ? Number(m[3]) : undefined)
  }
  return null
}

/**
 * Parse the date formats found in bibliographic data into a CSL date.
 * Returns undefined for empty input and explicit "no date" markers; text
 * without any recognisable year (e.g. "in press") becomes a `literal`.
 */
export function parseDateString(input: string): CslDate | undefined {
  const value = input.trim()
  if (!value || NO_DATE.test(value)) return undefined

  // EDTF / biblatex ranges: 2020-03-15/2020-03-20.
  const range = /^(\d{4}(?:-\d{1,2}){0,2})\/(\d{4}(?:-\d{1,2}){0,2})$/.exec(value)
  if (range) {
    const start = parseSingle(range[1]!)
    const end = parseSingle(range[2]!)
    if (start && end) return { 'date-parts': [start, end] }
  }

  const parts = parseSingle(value)
  if (parts) return { 'date-parts': [parts] }

  const year = /\b(1\d{3}|2\d{3})\b/.exec(value)
  if (year) return { 'date-parts': [[Number(year[1])]] }
  return { literal: value }
}

/** A CSL date for the given instant's UTC calendar day. */
export function calendarDate(now: Date): CslDate {
  return { 'date-parts': [[now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()]] }
}
