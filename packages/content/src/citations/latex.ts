// LaTeX → Unicode for BibTeX field values: accents (\'e, {\"o}, \c{c}),
// special letters (\ss, \o, \aa), escapes (\&, \%, \_), TeX ligatures
// (--, ---, ``, ''), ~ as a no-break space, a little math, and grouping
// braces removed. Formatting commands (\emph, \textbf, …) keep their text.

const COMBINING: Record<string, string> = {
  "'": '́',
  '`': '̀',
  '^': '̂',
  '"': '̈',
  '~': '̃',
  '=': '̄',
  '.': '̇',
  u: '̆',
  v: '̌',
  H: '̋',
  c: '̧',
  k: '̨',
  r: '̊',
  d: '̣',
  b: '̱',
  t: '͡',
}

const WORDS: Record<string, string> = {
  // Letters
  i: 'ı',
  j: 'ȷ',
  ss: 'ß',
  SS: 'SS',
  o: 'ø',
  O: 'Ø',
  aa: 'å',
  AA: 'Å',
  ae: 'æ',
  AE: 'Æ',
  oe: 'œ',
  OE: 'Œ',
  l: 'ł',
  L: 'Ł',
  dh: 'ð',
  DH: 'Ð',
  dj: 'đ',
  DJ: 'Đ',
  th: 'þ',
  TH: 'Þ',
  ng: 'ŋ',
  NG: 'Ŋ',
  // Text symbols
  textendash: '–',
  textemdash: '—',
  textquoteleft: '‘',
  textquoteright: '’',
  textquotedblleft: '“',
  textquotedblright: '”',
  textquotedbl: '"',
  guillemotleft: '«',
  guillemotright: '»',
  guillemetleft: '«',
  guillemetright: '»',
  guilsinglleft: '‹',
  guilsinglright: '›',
  ldots: '…',
  dots: '…',
  textellipsis: '…',
  textregistered: '®',
  texttrademark: '™',
  textcopyright: '©',
  copyright: '©',
  textdegree: '°',
  S: '§',
  P: '¶',
  textsection: '§',
  textparagraph: '¶',
  pounds: '£',
  textsterling: '£',
  euro: '€',
  texteuro: '€',
  textyen: '¥',
  textcent: '¢',
  textdollar: '$',
  textunderscore: '_',
  textasciitilde: '~',
  textasciicircum: '^',
  textbackslash: '\\',
  textbar: '|',
  textless: '<',
  textgreater: '>',
  textbullet: '•',
  textperiodcentered: '·',
  textdagger: '†',
  dag: '†',
  textdaggerdbl: '‡',
  ddag: '‡',
  textexclamdown: '¡',
  textquestiondown: '¿',
  textordfeminine: 'ª',
  textordmasculine: 'º',
  textmu: 'µ',
  textonehalf: '½',
  textvisiblespace: '␣',
  slash: '/',
  LaTeX: 'LaTeX',
  TeX: 'TeX',
  BibTeX: 'BibTeX',
  quad: ' ',
  qquad: ' ',
  enspace: ' ',
  thinspace: ' ',
  space: ' ',
  nobreakspace: ' ',
  // Math
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  vartheta: 'ϑ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  varpi: 'ϖ',
  rho: 'ρ',
  sigma: 'σ',
  varsigma: 'ς',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'φ',
  varphi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Upsilon: 'Υ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
  pm: '±',
  mp: '∓',
  times: '×',
  div: '÷',
  cdot: '·',
  leq: '≤',
  le: '≤',
  geq: '≥',
  ge: '≥',
  neq: '≠',
  ne: '≠',
  approx: '≈',
  sim: '∼',
  simeq: '≃',
  equiv: '≡',
  infty: '∞',
  partial: '∂',
  nabla: '∇',
  sum: '∑',
  prod: '∏',
  int: '∫',
  sqrt: '√',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  Rightarrow: '⇒',
  leftrightarrow: '↔',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  subseteq: '⊆',
  cup: '∪',
  cap: '∩',
  emptyset: '∅',
  forall: '∀',
  exists: '∃',
  neg: '¬',
  wedge: '∧',
  vee: '∨',
  langle: '⟨',
  rangle: '⟩',
  ell: 'ℓ',
  hbar: 'ℏ',
  prime: '′',
  circ: '∘',
  bullet: '•',
  star: '⋆',
  ast: '∗',
  propto: '∝',
  perp: '⊥',
  parallel: '∥',
  cdots: '⋯',
  mid: '|',
  lbrace: '{',
  rbrace: '}',
  backslash: '\\',
}

// Commands whose first argument is not text and should be dropped.
const DROP_FIRST_ARG = new Set(['href', 'label', 'cite', 'ref', 'hspace', 'vspace'])

const ESCAPES = new Set(['&', '%', '_', '$', '#', '{', '}', '@'])

class Converter {
  private pos = 0
  private math = false

  constructor(private readonly src: string) {}

  run(): string {
    let out = ''
    const src = this.src
    while (this.pos < src.length) {
      const ch = src[this.pos]!
      if (ch === '\\') {
        out += this.command()
      } else if (ch === '{' || ch === '}') {
        this.pos++
      } else if (ch === '$') {
        this.math = !this.math
        this.pos++
      } else if (this.math && (ch === '^' || ch === '_')) {
        this.pos++
      } else if (ch === '~') {
        out += ' '
        this.pos++
      } else if (ch === '-') {
        if (src.startsWith('---', this.pos)) {
          out += '—'
          this.pos += 3
        } else if (src.startsWith('--', this.pos)) {
          out += '–'
          this.pos += 2
        } else {
          out += '-'
          this.pos++
        }
      } else if (ch === '`') {
        const double = src[this.pos + 1] === '`'
        out += double ? '“' : '‘'
        this.pos += double ? 2 : 1
      } else if (ch === "'" && src[this.pos + 1] === "'") {
        out += '”'
        this.pos += 2
      } else {
        out += ch
        this.pos++
      }
    }
    return out
  }

  /** The raw text of a balanced `{…}` group starting at `pos`. */
  private group(): string {
    const src = this.src
    let depth = 0
    const start = this.pos + 1
    for (; this.pos < src.length; this.pos++) {
      const ch = src[this.pos]
      if (ch === '\\') {
        this.pos++
        continue
      }
      if (ch === '{') depth++
      else if (ch === '}' && --depth === 0) {
        this.pos++
        return src.slice(start, this.pos - 1)
      }
    }
    return src.slice(start)
  }

  /** An accent's argument: `{e}`, `e`, `\i`, or `{\i}`, already converted. */
  private argument(): string {
    const src = this.src
    while (src[this.pos] === ' ') this.pos++
    const ch = src[this.pos]
    if (ch === undefined) return ''
    if (ch === '{') return new Converter(this.group()).run()
    if (ch === '\\') return this.command()
    this.pos++
    return ch
  }

  private skipSpaces(): void {
    while (/\s/.test(this.src[this.pos] ?? '')) this.pos++
  }

  private command(): string {
    const src = this.src
    this.pos++ // the backslash
    const next = src[this.pos]
    if (next === undefined) return ''

    if (/[a-zA-Z]/.test(next)) {
      const word = /^[a-zA-Z]+/.exec(src.slice(this.pos, this.pos + 40))![0]
      this.pos += word.length
      // In TeX a control word swallows the spaces after it.
      this.skipSpaces()
      const combining = word.length === 1 ? COMBINING[word] : undefined
      if (combining) return accent(this.argument(), combining)
      if (DROP_FIRST_ARG.has(word) && src[this.pos] === '{') {
        this.group()
        return ''
      }
      // Formatting and unknown commands vanish; their braced argument is
      // then read as ordinary text by the main loop.
      return WORDS[word] ?? ''
    }

    this.pos++
    const combining = COMBINING[next]
    if (combining) return accent(this.argument(), combining)
    if (ESCAPES.has(next)) return next === '@' ? '' : next
    if (next === '\\') return ' '
    if (next === ' ' || next === ',' || next === ';' || next === ':') return ' '
    if (next === '!' || next === '-' || next === '/') return ''
    return next
  }
}

function accent(text: string, combining: string): string {
  if (!text) return ''
  const chars = Array.from(text)
  // \'{\i} is how TeX writes í; drop the dotless form before accenting.
  const base = chars[0] === 'ı' ? 'i' : chars[0] === 'ȷ' ? 'j' : chars[0]!
  return base + combining + chars.slice(1).join('')
}

/** Convert a BibTeX field value to plain Unicode text. */
export function decodeLatex(value: string): string {
  if (!/[\\{}$~`'-]/.test(value)) return value.replace(/\s+/g, ' ').trim()
  return new Converter(value)
    .run()
    .normalize('NFC')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim()
}
