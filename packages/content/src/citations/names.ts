import type { CslName } from './csl'

// Personal-name parsing in the BibTeX tradition ("First von Last",
// "von Last, First", "von Last, Jr, First"). Braces protect a group from
// being split, so `{World Health Organization}` stays one literal name.
// Also used for plain names from RIS files, arXiv and HTML meta tags.

type Decode = (value: string) => string

const identity: Decode = (value) => value.trim()

const SUFFIX = /^(?:(?:jr|sr|jnr|snr)\.?|II|III|IV)$/i

function isLetter(ch: string): boolean {
  return ch.toLowerCase() !== ch.toUpperCase()
}

/** Split on a top-level separator (outside braces). */
function splitTopLevel(value: string, isSeparator: (value: string, i: number) => number): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!
    if (ch === '\\') {
      i++
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') depth = Math.max(0, depth - 1)
    else if (depth === 0) {
      const width = isSeparator(value, i)
      if (width > 0) {
        parts.push(value.slice(start, i))
        start = i + width
        i += width - 1
      }
    }
  }
  parts.push(value.slice(start))
  return parts
}

/** Split a BibTeX name list on top-level ` and ` (case-insensitive). */
export function splitNameList(value: string): string[] {
  return splitTopLevel(value, (text, i) => {
    const m = /^\s+and\s+/i.exec(text.slice(i, i + 8))
    return m && /\s/.test(text[i]!) ? m[0].length : 0
  })
    .map((name) => name.trim())
    .filter(Boolean)
}

function words(part: string): string[] {
  return splitTopLevel(part, (text, i) => (/[\s~]/.test(text[i]!) ? 1 : 0)).filter(Boolean)
}

type Case = 'lower' | 'upper' | 'none'

// The case of a name token decides whether it belongs to the "von" part.
// A brace group that is not a TeX special character (`{\"u}`) is caseless.
function tokenCase(token: string): Case {
  for (let i = 0; i < token.length; i++) {
    const ch = token[i]!
    if (ch === '{') {
      if (token[i + 1] !== '\\') return 'none'
      const rest = token.slice(i + 2)
      // `{\ss}`, `{\o}` …: the command itself is the letter.
      const word = /^([a-zA-Z]+)/.exec(rest)?.[1]
      if (
        word &&
        ['ss', 'o', 'O', 'aa', 'AA', 'ae', 'AE', 'oe', 'OE', 'l', 'L', 'i', 'j'].includes(word)
      )
        return word === word.toLowerCase() ? 'lower' : 'upper'
      // Accent commands (`{\"u}`, `{\v{s}}`): use the accented letter.
      const letter = /^(?:[a-zA-Z]+|.)[\s{]*([a-zA-Z])/.exec(rest)?.[1]
      if (!letter) return 'none'
      return letter === letter.toLowerCase() ? 'lower' : 'upper'
    }
    if (ch === '\\') {
      i++
      continue
    }
    if (isLetter(ch)) return ch === ch.toLowerCase() ? 'lower' : 'upper'
  }
  return 'none'
}

function isWholeGroup(value: string): boolean {
  if (!value.startsWith('{') || !value.endsWith('}')) return false
  let depth = 0
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!
    if (ch === '\\') {
      i++
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0 && i < value.length - 1) return false
    }
  }
  return depth === 0
}

function build(
  decode: Decode,
  first: string[],
  von: string[],
  last: string[],
  suffix?: string
): CslName {
  const name: CslName = {}
  const family = decode(last.join(' '))
  const given = decode(first.join(' '))
  const particle = decode(von.join(' '))
  if (family) name.family = family
  if (given) name.given = given
  if (particle) name['non-dropping-particle'] = particle
  if (suffix) {
    const decoded = decode(suffix)
    if (decoded) name.suffix = decoded
  }
  if (!name.family) {
    // "von" with nothing after it, or only a given name: keep what we have.
    const literal = [name.given, name['non-dropping-particle']].filter(Boolean).join(' ')
    return literal ? { literal } : {}
  }
  return name
}

// "von Last" from the part before the first comma.
function splitVonLast(tokens: string[]): { von: string[]; last: string[] } {
  let end = -1
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokenCase(tokens[i]!) === 'lower') end = i
    else break
  }
  return { von: tokens.slice(0, end + 1), last: tokens.slice(end + 1) }
}

/**
 * Parse one personal name. `decode` turns each assembled part into display
 * text (the BibTeX reader passes its LaTeX decoder; the default trims).
 */
export function parseName(raw: string, decode: Decode = identity): CslName {
  const value = raw.trim().replace(/,\s*$/, '')
  if (!value) return {}
  if (isWholeGroup(value)) {
    const literal = decode(value.slice(1, -1))
    return literal ? { literal } : {}
  }

  const parts = splitTopLevel(value, (text, i) => (text[i] === ',' ? 1 : 0)).map((p) => p.trim())

  if (parts.length === 1) {
    const tokens = words(value)
    let suffix: string | undefined
    if (tokens.length > 2 && SUFFIX.test(tokens.at(-1)!)) suffix = tokens.pop()
    if (tokens.length === 1) return build(decode, [], [], tokens, suffix)
    // First von Last: von runs from the first to the last lowercase word,
    // and the final word always belongs to Last.
    let vonStart = -1
    let vonEnd = -1
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokenCase(tokens[i]!) === 'lower') {
        if (vonStart < 0) vonStart = i
        vonEnd = i
      }
    }
    if (vonStart < 0) return build(decode, tokens.slice(0, -1), [], tokens.slice(-1), suffix)
    return build(
      decode,
      tokens.slice(0, vonStart),
      tokens.slice(vonStart, vonEnd + 1),
      tokens.slice(vonEnd + 1),
      suffix
    )
  }

  if (parts.length === 2) {
    // "First Last, Jr." is common outside BibTeX; read it as a suffix.
    if (SUFFIX.test(parts[1]!)) {
      const inner = parseName(parts[0]!, decode)
      const suffix = decode(parts[1]!)
      return suffix && (inner.family || inner.literal) ? { ...inner, suffix } : inner
    }
    const { von, last } = splitVonLast(words(parts[0]!))
    return build(decode, words(parts[1]!), von, last)
  }

  // von Last, Jr, First — also accept the "Last, First, Jr." ordering.
  let jr = parts[1]!
  let first = parts.slice(2).join(' ')
  if (SUFFIX.test(parts[2]!) && !SUFFIX.test(parts[1]!)) {
    jr = parts[2]!
    first = [parts[1]!, ...parts.slice(3)].join(' ')
  }
  const { von, last } = splitVonLast(words(parts[0]!))
  return build(decode, words(first), von, last, jr || undefined)
}
