// Small string helpers shared by the parsers, the resolver and the formatter.
// Dependency-free and DOM-free so they run in Workers, browsers and Bun.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  trade: '™',
  middot: '·',
  bull: '•',
  deg: '°',
  times: '×',
  minus: '−',
  shy: '',
  thinsp: ' ',
  ensp: ' ',
  emsp: ' ',
  zwnj: '',
  zwj: '',
}

/** Decode HTML/XML character references (named, decimal and hex). */
export function decodeEntities(value: string): string {
  if (!value.includes('&')) return value
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, ref: string) => {
    if (ref[0] === '#') {
      const code =
        ref[1] === 'x' || ref[1] === 'X'
          ? Number.parseInt(ref.slice(2), 16)
          : Number.parseInt(ref.slice(1), 10)
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match
      return String.fromCodePoint(code)
    }
    const named = NAMED_ENTITIES[ref.toLowerCase()]
    return named ?? match
  })
}

/** Collapse runs of whitespace (but not no-break spaces) into one space and trim. */
export function collapseWhitespace(value: string): string {
  return value.replace(/[ \t\r\n\f\v]+/g, ' ').trim()
}

/**
 * Plain text from a fragment of HTML or JATS XML (Crossref titles carry
 * `<i>`, `<sub>`, `<jats:italic>` …): drop the tags, decode entities and
 * normalise whitespace.
 */
export function stripMarkup(value: string): string {
  if (!value.includes('<') && !value.includes('&')) return collapseWhitespace(value)
  return collapseWhitespace(decodeEntities(value.replace(/<[^>]*>/g, '')))
}

// The rich-text tags CSL-JSON allows in titles (citeproc-js "HTML-like" markup).
const CSL_MARKUP = /<\/?(?:i|b|em|strong|sup|sub|sc|span)(?:\s[^<>]*)?>/gi

/**
 * Remove CSL-JSON rich-text tags (`<i>`, `<sup>`, `<span class="nocase">` …)
 * but leave other angle brackets alone, so "a < b" survives.
 */
export function stripCslMarkup(value: string): string {
  return value.includes('<') ? collapseWhitespace(value.replace(CSL_MARKUP, '')) : value
}

// Letters that NFD does not decompose into base + combining mark.
const FOLD_SPECIAL: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  Æ: 'AE',
  ø: 'o',
  Ø: 'O',
  œ: 'oe',
  Œ: 'OE',
  đ: 'd',
  Đ: 'D',
  ð: 'd',
  Ð: 'D',
  ł: 'l',
  Ł: 'L',
  þ: 'th',
  Þ: 'TH',
  ı: 'i',
  ŋ: 'ng',
  Ŋ: 'NG',
}

/** Fold accented Latin letters to ASCII (`Müller` → `Muller`, `Ørsted` → `Orsted`). */
export function foldAscii(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ßæÆøØœŒđĐðÐłŁþÞıŋŊ]/g, (ch) => FOLD_SPECIAL[ch] ?? ch)
}

/** A case- and accent-insensitive key used for sorting and comparisons. */
export function sortableText(value: string): string {
  return foldAscii(value)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
