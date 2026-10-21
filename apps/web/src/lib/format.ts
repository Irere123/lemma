const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const dayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const yearFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** "just now", "5 min ago", "3 h ago", "yesterday", "12 Oct", "12 Oct 2024". */
export function relativeTime(value: Date | string | number | null | undefined, now = Date.now()) {
  if (value === null || value === undefined) return ''
  const date = value instanceof Date ? value : new Date(value)
  const time = date.getTime()
  if (Number.isNaN(time)) return ''
  const ago = now - time
  if (ago < MINUTE) return 'just now'
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min ago`
  if (ago < DAY) return `${Math.floor(ago / HOUR)} h ago`
  if (ago < 2 * DAY) return 'yesterday'
  if (ago < 7 * DAY) return `${Math.floor(ago / DAY)} days ago`
  return date.getFullYear() === new Date(now).getFullYear()
    ? dayFormat.format(date)
    : yearFormat.format(date)
}

const numberFormat = new Intl.NumberFormat()

export const formatNumber = (n: number) => numberFormat.format(n)

/** "1 word", "1,240 words". */
export function formatWords(value: number | string | null | undefined) {
  const n = Number(value) || 0
  return `${formatNumber(n)} ${n === 1 ? 'word' : 'words'}`
}

/** "Good morning" / "Good afternoon" / "Good evening". */
export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 5) return 'Good evening'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** The local calendar day as YYYY-MM-DD (a daily note's key). */
export function localDay(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "Tuesday, 21 October 2026" — a daily note's title. */
export const longDate = (date = new Date()) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** A document id chosen on the device (22 base62 characters), for offline creation. */
export function newClientId() {
  const bytes = crypto.getRandomValues(new Uint8Array(22))
  return Array.from(bytes, (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('')
}
