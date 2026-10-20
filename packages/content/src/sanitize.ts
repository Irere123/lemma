// Zero-dependency output guards shared by the renderers and the schema.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Allow only safe URL schemes; block javascript:/vbscript:, and data: unless allowed.
export function sanitizeUrl(url: unknown, { allowData = false } = {}): string | null {
  if (typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null

  if (/^(\/|#|\.\/|\.\.\/)/.test(trimmed)) return trimmed

  const match = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)
  if (!match) return trimmed

  const scheme = (match[1] ?? '').toLowerCase()
  if (scheme === 'data') {
    // Only raster/vector images, never data:text/html and friends.
    return allowData && /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);/i.test(trimmed)
      ? trimmed
      : null
  }
  return ['http', 'https', 'mailto', 'tel'].includes(scheme) ? trimmed : null
}

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FUNCTIONAL = /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(\s*[-+\d.\s,%/a-z]*\)$/i
const NAMED = /^[a-z]{3,24}$/i
const CSS_VAR = /^var\(--[a-z0-9-]{1,64}\)$/i
// Inside a functional colour, letters are only legitimate as units or `none`.
const FUNCTIONAL_WORDS = /[a-z]+/gi
const FUNCTIONAL_ALLOWED = new Set(['deg', 'rad', 'grad', 'turn', 'none'])

/**
 * A CSS colour that is safe to drop into `style="color: …"`. Anything with a
 * `;`, `:`, `url(` or other declaration syntax is rejected, so a stored colour
 * can never smuggle extra CSS onto the page.
 */
export function safeCssColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const color = value.trim()
  if (!color || color.length > 64) return null
  if (HEX.test(color) || CSS_VAR.test(color)) return color
  if (NAMED.test(color)) return color.toLowerCase()
  if (FUNCTIONAL.test(color)) {
    const inner = color.slice(color.indexOf('(') + 1, -1)
    const words = inner.match(FUNCTIONAL_WORDS) ?? []
    return words.every((word) => FUNCTIONAL_ALLOWED.has(word.toLowerCase())) ? color : null
  }
  return null
}
