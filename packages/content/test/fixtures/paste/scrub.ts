// Builds the scrubbed paste fixtures in this directory from the Phase A clipboard
// corpus (lemma-editor-study/corpus, which is not in the repo: its captures carry
// third-party text). Markup is copied byte for byte; human-language text is
// replaced with deterministic filler of the same shape. See README.md.
//
//   bun test/fixtures/paste/scrub.ts                    rewrite every scrubbed fixture
//   bun test/fixtures/paste/scrub.ts --check            rebuild in memory and fail if a
//                                                       committed fixture differs
//   bun test/fixtures/paste/scrub.ts --outline <out>    list a capture's prunable blocks
//
// Every run verifies each fixture against its source (same DOM shape, same text
// shape) and prints a leak report: words and word trigrams of the source text
// that survive anywhere in the fixture's text or attributes.
//
// The Word fixtures are hand-written (README.md) and not built here.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

import { CORPUS_ROOT } from '../../paste-corpus'

if (!globalThis.document) GlobalRegistrator.register()

const OUT = import.meta.dir

// ---------------------------------------------------------------------------
// What to build

/** Keep only these element children (inclusive index ranges) of a container. */
type Prune = { container: string; nth?: number; keep: Array<number | [number, number]> }
type Spec = { out: string; from: string; sha256: string; prune?: Prune[] }

const SPECS: Spec[] = [
  {
    out: 'chatgpt/energy-comparison-math-copy-button.html',
    from: 'clipboard/chatgpt/energy-comparison-math-copy-button.html',
    sha256: 'dad6496868a6cb5a9ffaecf04abc296e23e4ee28e712c6fdb3e7d8fc0383124b',
  },
  {
    out: 'chatgpt/energy-comparison-math-selection.html',
    from: 'clipboard/chatgpt/energy-comparison-math-selection.html',
    sha256: 'f241f109682914445b420b870814847086c00a2e50d0922936cf1b12f1078900',
  },
  {
    out: 'chatgpt/inline-images-console-code-selection.html',
    from: 'clipboard/chatgpt/inline-images-console-code-selection.html',
    sha256: 'c6e3b42fb3089c184dba4cb64a4e46e0ce1321af66989b727f1c730fc5c40809',
  },
  {
    out: 'google-docs/android-child-process-priority.html',
    from: 'clipboard/google-docs/android-child-process-priority.html',
    sha256: '870c7a346022a005bf62d86f66e0c9ceaaecdcf9d558b26078da4cf2f3c36dbb',
    prune: [
      {
        container: 'b[id^="docs-internal-guid-"]',
        keep: [
          [0, 12],
          [35, 51],
        ],
      },
    ],
  },
  {
    out: 'google-docs/material-design-downloads.html',
    from: 'clipboard/google-docs/material-design-downloads.html',
    sha256: '2555e58133180869fa78ec3c9b41d4fef9ca8bf7315f5b73729252ac3f84ec3e',
    prune: [
      {
        container: 'b[id^="docs-internal-guid-"]',
        keep: [
          [0, 9],
          [43, 49],
          [56, 60],
          [86, 92],
          [99, 111],
          [159, 163],
          194,
          [206, 207],
          [218, 219],
          [222, 224],
          [265, 269],
        ],
      },
    ],
  },
  {
    out: 'google-docs/plugin-power-saver.html',
    from: 'clipboard/google-docs/plugin-power-saver.html',
    sha256: '32a614deeeaeb4746f3d973347c7eb25e3fbded24d5174bb18cfb57d6641f8bc',
    prune: [
      {
        container: 'b[id^="docs-internal-guid-"]',
        keep: [
          [0, 4],
          [19, 40],
          [55, 57],
          [61, 67],
          [71, 77],
          [86, 92],
          [129, 133],
        ],
      },
    ],
  },
  {
    out: 'google-docs/session-history-oopif.html',
    from: 'clipboard/google-docs/session-history-oopif.html',
    sha256: 'e9642b8401555dce1138d619e81959420f21c6179807003a578a2902dc1a6e46',
    prune: [
      { container: 'ul', nth: 5, keep: [[0, 1]] },
      {
        container: 'b[id^="docs-internal-guid-"]',
        keep: [
          [0, 8],
          [19, 35],
          [82, 98],
          [109, 115],
        ],
      },
    ],
  },
  {
    out: 'notion/app-demo-page-fixture-blok.html',
    from: 'clipboard/notion/app-demo-page-fixture-blok.html',
    sha256: 'c57cc9c249b5d2bd1953cc927a673216661df13457f04ef6561c9acf7bef1d26',
    prune: [
      {
        container: 'body',
        keep: [
          [0, 27],
          42,
          [51, 55],
          [63, 64],
          70,
          73,
          [75, 76],
          [109, 110],
          [128, 131],
          137,
          140,
          [141, 149],
          155,
          158,
          160,
          [163, 164],
          [182, 197],
          214,
        ],
      },
    ],
  },
  {
    out: 'notion/app-page-fixture-pasteinto.html',
    from: 'clipboard/notion/app-page-fixture-pasteinto.html',
    sha256: '77473028ab9c12f187594286c5cda3cc705712ea2e426cbf869adbf51faeb973',
  },
  {
    out: 'notion/notion-guide.html',
    from: 'clipboard/notion/notion-guide.html',
    sha256: '4cd11d6d4284e157072ca6a52dce949948223f02a05c3bb27996c930adc2fcc9',
    prune: [
      {
        container: 'body',
        keep: [
          [0, 8],
          [11, 12],
        ],
      },
    ],
  },
  {
    out: 'notion/notion-tools-blocks-demo.html',
    from: 'clipboard/notion/notion-tools-blocks-demo.html',
    sha256: 'c92c4f4c1d61c287f9132d422a8e32aac104165192f6b62961d26148c7cee4ae',
    prune: [{ container: 'body', keep: [[1, 6], 8, [11, 12], 14, [16, 17], 19] }],
  },
  {
    out: 'wikipedia/markdown-variants-to-references.html',
    from: 'clipboard/wikipedia/markdown-variants-to-references.html',
    sha256: 'e6eebabb3d82886aba92007fc15763016318dae7d4741b6302229db2554cee99',
    prune: [
      { container: 'ol.references', nth: 1, keep: [[0, 2]] },
      { container: 'tbody', nth: 0, keep: [0, 2, 4] },
      { container: 'section', nth: 0, keep: [0, [2, 3]] },
      { container: 'body', keep: [0, 1, [3, 5], 7] },
    ],
  },
  {
    out: 'wikipedia/pride-and-prejudice-lead-plot-characters.html',
    from: 'clipboard/wikipedia/pride-and-prejudice-lead-plot-characters.html',
    sha256: '52ce5c7be08fa18c78b12b0ba8b90dd3cc6fc7a9039070612a6b74ac4fff46d0',
    prune: [
      { container: 'tbody', keep: [[0, 6]] },
      { container: 'section', nth: 0, keep: [[0, 1], 5] },
      { container: 'section', nth: 1, keep: [[0, 3], 7] },
      { container: 'section', nth: 2, keep: [0, [2, 3]] },
    ],
  },
  {
    out: 'arxiv/paper-body.html',
    from: 'paper/paper.html',
    sha256: '9e8a956f293fc9db56508de66a9b70b2c97a0cd4faf8d04c4d66a41bdafd4325',
    prune: [
      { container: 'ul.ltx_biblist', keep: [[0, 4]] },
      { container: '[id="S3.SS2"]', keep: [[0, 3]] },
      { container: 'section#S3', keep: [[0, 2], 5] },
      { container: 'article', keep: [[0, 5], 7, [11, 13]] },
    ],
  },
]

// ---------------------------------------------------------------------------
// Tokenizer: offsets into the source, so unchanged bytes are copied verbatim.

type Attr = { name: string; value: string; start: number; end: number; quote: string }
type StartTag = {
  kind: 'start'
  name: string
  attrs: Attr[]
  start: number
  end: number
  selfClosing: boolean
}
type Token =
  | StartTag
  | { kind: 'end'; name: string; start: number; end: number }
  | { kind: 'text' | 'comment' | 'decl' | 'raw'; start: number; end: number }

const RAW_TEXT = new Set(['style', 'script', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript'])
const RCDATA = new Set(['title', 'textarea'])

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let text = 0
  const flush = (end: number) => {
    if (end > text) tokens.push({ kind: 'text', start: text, end })
  }
  while (i < src.length) {
    const lt = src.indexOf('<', i)
    if (lt === -1) break
    const next = src[lt + 1] ?? ''
    let token: Token | null = null
    if (src.startsWith('<!--', lt)) {
      const close = src.indexOf('-->', lt + 4)
      token = { kind: 'comment', start: lt, end: close === -1 ? src.length : close + 3 }
    } else if (next === '!' || next === '?') {
      const close = src.indexOf('>', lt)
      token = { kind: 'decl', start: lt, end: close === -1 ? src.length : close + 1 }
    } else if (next === '/' && /[a-z]/i.test(src[lt + 2] ?? '')) {
      const close = src.indexOf('>', lt)
      const end = close === -1 ? src.length : close + 1
      const name = /^<\/([^\s/>]+)/.exec(src.slice(lt, end))?.[1]?.toLowerCase() ?? ''
      token = { kind: 'end', name, start: lt, end }
    } else if (/[a-z]/i.test(next)) {
      token = startTag(src, lt)
    }
    if (!token) {
      i = lt + 1
      continue
    }
    flush(lt)
    tokens.push(token)
    i = text = token.end
    if (
      token.kind === 'start' &&
      !token.selfClosing &&
      (RAW_TEXT.has(token.name) || RCDATA.has(token.name))
    ) {
      const close = new RegExp(`</${token.name}[\\s>/]`, 'ig')
      close.lastIndex = i
      const end = close.exec(src)?.index ?? src.length
      if (end > i) tokens.push({ kind: RCDATA.has(token.name) ? 'text' : 'raw', start: i, end })
      i = text = end
    }
  }
  flush(src.length)
  return tokens
}

function startTag(src: string, lt: number): StartTag {
  let i = lt + 1
  while (i < src.length && !/[\s/>]/.test(src[i] ?? '')) i++
  const name = src.slice(lt + 1, i).toLowerCase()
  const attrs: Attr[] = []
  let selfClosing = false
  while (i < src.length) {
    const c = src[i] ?? ''
    if (c === '>') {
      i++
      break
    }
    if (c === '/') {
      if (src[i + 1] === '>') {
        selfClosing = true
        i += 2
        break
      }
      i++
      continue
    }
    if (/\s/.test(c)) {
      i++
      continue
    }
    const nameStart = i
    i++
    while (i < src.length && !/[\s/>=]/.test(src[i] ?? '')) i++
    const attrName = src.slice(nameStart, i).toLowerCase()
    let j = i
    while (/\s/.test(src[j] ?? '')) j++
    if (src[j] !== '=') {
      attrs.push({ name: attrName, value: '', start: i, end: i, quote: '' })
      continue
    }
    j++
    while (/\s/.test(src[j] ?? '')) j++
    const quote = src[j] ?? ''
    if (quote === '"' || quote === "'") {
      const close = src.indexOf(quote, j + 1)
      const end = close === -1 ? src.length : close
      attrs.push({ name: attrName, value: src.slice(j + 1, end), start: j + 1, end, quote })
      i = end + 1
    } else {
      const start = j
      while (j < src.length && !/[\s>]/.test(src[j] ?? '')) j++
      attrs.push({ name: attrName, value: src.slice(start, j), start, end: j, quote: '' })
      i = j
    }
  }
  return { kind: 'start', name, attrs, start: lt, end: i, selfClosing }
}

// ---------------------------------------------------------------------------
// Element tree (enough of the HTML tree builder for well-formed clipboard HTML;
// every container that gets pruned is checked against happy-dom's parse).

type El = {
  name: string
  attrs: Map<string, string>
  classes: string[]
  start: number
  end: number
  /** Where the content ends (the end tag's start, or `end` if closed implicitly). */
  contentEnd: number
  children: El[]
  parent: El | null
  foreign: boolean
}

const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])
const CLOSES_P = new Set(
  'address article aside blockquote details dialog div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr main menu nav ol p pre section table ul'.split(
    ' '
  )
)
const SCOPE = new Set(['table', 'td', 'th', 'caption', 'button', 'object', 'template', 'html'])

function element(name: string, attrs: Attr[], start: number, parent: El | null): El {
  const map = new Map(attrs.map((attr) => [attr.name, decodeEntities(attr.value)]))
  return {
    name,
    attrs: map,
    classes: (map.get('class') ?? '').split(/\s+/).filter(Boolean),
    start,
    end: start,
    contentEnd: start,
    children: [],
    parent,
    foreign: false,
  }
}

function parse(src: string): { tokens: Token[]; root: El; owner: El[]; elements: (El | null)[] } {
  const tokens = tokenize(src)
  const root = element('#root', [], 0, null)
  root.end = root.contentEnd = src.length
  const stack: El[] = [root]
  const owner: El[] = []
  const elements: (El | null)[] = []
  const top = () => stack[stack.length - 1] as El
  const close = (at: number, until: number) => {
    while (stack.length > until) {
      const el = stack.pop() as El
      el.end = el.contentEnd = at
    }
  }
  const closeOpen = (names: string[], at: number, boundaries: Set<string>) => {
    for (let k = stack.length - 1; k > 0; k--) {
      const el = stack[k] as El
      if (names.includes(el.name)) return close(at, k)
      if (boundaries.has(el.name) || el.foreign) return
    }
  }
  tokens.forEach((token, index) => {
    owner[index] = top()
    elements[index] = null
    if (token.kind === 'start') {
      const inForeign = top().foreign
      if (!inForeign) {
        if (CLOSES_P.has(token.name)) closeOpen(['p'], token.start, SCOPE)
        if (token.name === 'li') closeOpen(['li'], token.start, new Set([...SCOPE, 'ul', 'ol']))
        if (token.name === 'dt' || token.name === 'dd')
          closeOpen(['dt', 'dd'], token.start, new Set([...SCOPE, 'dl']))
        if (token.name === 'td' || token.name === 'th')
          closeOpen(['td', 'th'], token.start, new Set(['tr', 'table']))
        if (token.name === 'tr')
          closeOpen(['tr'], token.start, new Set(['tbody', 'thead', 'tfoot', 'table']))
      }
      owner[index] = top()
      const el = element(token.name, token.attrs, token.start, top())
      el.foreign = inForeign || token.name === 'math' || token.name === 'svg'
      el.end = el.contentEnd = token.end
      top().children.push(el)
      elements[index] = el
      const isVoid = el.foreign ? token.selfClosing : VOID.has(token.name)
      if (!isVoid) stack.push(el)
    } else if (token.kind === 'end') {
      for (let k = stack.length - 1; k > 0; k--) {
        if ((stack[k] as El).name !== token.name) continue
        close(token.start, k + 1)
        const el = stack.pop() as El
        el.contentEnd = token.start
        el.end = token.end
        break
      }
    }
  })
  close(src.length, 1)
  return { tokens, root, owner, elements }
}

function compileSelector(selector: string): (el: El) => boolean {
  const match = /^([a-z][\w-]*)?((?:[#.][\w-]+|\[[^\]]+\])*)$/i.exec(selector)
  if (!match) throw new Error(`Unsupported selector: ${selector}`)
  const tag = match[1]?.toLowerCase()
  const tests = (match[2]?.match(/[#.][\w-]+|\[[^\]]+\]/g) ?? []).map((part) => {
    if (part.startsWith('#')) return (el: El) => el.attrs.get('id') === part.slice(1)
    if (part.startsWith('.')) return (el: El) => el.classes.includes(part.slice(1))
    const attr = /^\[([\w:-]+)(?:([\^*]?=)"?([^"]*)"?)?\]$/.exec(part)
    if (!attr) throw new Error(`Unsupported selector: ${selector}`)
    const [, name = '', op, want = ''] = attr
    return (el: El) => {
      const value = el.attrs.get(name)
      if (value === undefined) return false
      if (op === '=') return value === want
      if (op === '^=') return value.startsWith(want)
      if (op === '*=') return value.includes(want)
      return true
    }
  })
  return (el) => (!tag || el.name === tag) && tests.every((test) => test(el))
}

function find(root: El, selector: string, nth: number): El | null {
  const matches = compileSelector(selector)
  const found: El[] = []
  const visit = (el: El) => {
    if (el !== root && matches(el)) found.push(el)
    el.children.forEach(visit)
  }
  visit(root)
  // A fragment without <body> tags: its top level is what the DOM puts in <body>.
  if (selector === 'body' && found.length === 0) return root
  return found[nth] ?? null
}

function domContainer(src: string, rule: Prune): Element {
  const doc = new DOMParser().parseFromString(src, 'text/html')
  const container = doc.querySelectorAll(rule.container)[rule.nth ?? 0]
  if (!container) throw new Error(`${rule.container}: no match in happy-dom's parse`)
  return container
}

const HEAD_ONLY = new Set(['meta', 'link', 'style', 'title', 'base'])

function prune(src: string, rule: Prune): string {
  const { root } = parse(src)
  const container = find(root, rule.container, rule.nth ?? 0)
  if (!container) throw new Error(`${rule.container}: no match`)
  const ours = container.children
    .filter((child) => container !== root || !HEAD_ONLY.has(child.name))
    .map((child) => child.name)
    .join(' ')
  const theirs = Array.from(domContainer(src, rule).children, (child) =>
    child.tagName.toLowerCase()
  ).join(' ')
  if (ours !== theirs) throw new Error(`${rule.container}: tree differs from happy-dom's`)
  const keep = new Set<number>()
  for (const range of rule.keep) {
    const [from, to] = typeof range === 'number' ? [range, range] : range
    for (let i = from; i <= to; i++) keep.add(i)
  }
  const cuts: Array<[number, number]> = []
  container.children.forEach((child, index) => {
    if (keep.has(index)) return
    const boundary = container.children[index + 1]?.start ?? container.contentEnd
    const gap = src.slice(child.end, boundary)
    cuts.push([child.start, /^\s*$/.test(gap) ? boundary : child.end])
  })
  let out = src
  for (const [start, end] of cuts.reverse()) out = out.slice(0, start) + out.slice(end)
  return out
}

// ---------------------------------------------------------------------------
// Filler

function seeded(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const span = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i))
const POOLS = {
  lower: [...'abcdefghijklmnopqrstuvwxyz'],
  upper: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
  digits: [...'0123456789'],
  hex: [...'0123456789abcdef'],
  latinLower: [...'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ'],
  latinUpper: [...'ÀÁÂÄÃÅÇÈÉÊËÌÍÎÏÑÒÓÔÖÕÙÚÛÜÝ'],
  cyrillicLower: [...'абвгдежзийклмнопрстуфхцчшщыэюя'],
  cyrillicUpper: [...'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЭЮЯ'],
  greekLower: [...'αβγδεζηθικλμνξοπρστυφχψω'],
  greekUpper: [...'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ'],
  han: span(0x4e00, 0x4fff),
  hiragana: span(0x3041, 0x3093),
  katakana: span(0x30a1, 0x30f3),
  hangul: span(0xac00, 0xadff),
  arabic: [...'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'],
  hebrew: span(0x05d0, 0x05ea),
  devanagari: span(0x0915, 0x0939),
  thai: span(0x0e01, 0x0e2e),
}
const SCRIPTS: Array<[RegExp, keyof typeof POOLS, keyof typeof POOLS]> = [
  [/\p{Script=Latin}/u, 'latinLower', 'latinUpper'],
  [/\p{Script=Cyrillic}/u, 'cyrillicLower', 'cyrillicUpper'],
  [/\p{Script=Greek}/u, 'greekLower', 'greekUpper'],
  [/\p{Script=Han}/u, 'han', 'han'],
  [/\p{Script=Hiragana}/u, 'hiragana', 'hiragana'],
  [/\p{Script=Katakana}/u, 'katakana', 'katakana'],
  [/\p{Script=Hangul}/u, 'hangul', 'hangul'],
  [/\p{Script=Arabic}/u, 'arabic', 'arabic'],
  [/\p{Script=Hebrew}/u, 'hebrew', 'hebrew'],
  [/\p{Script=Devanagari}/u, 'devanagari', 'devanagari'],
  [/\p{Script=Thai}/u, 'thai', 'thai'],
]

const pick = (rand: () => number, pool: string[]) =>
  pool[Math.floor(rand() * pool.length)] as string

/** A random character of the same class: letter (script and case kept), digit, or itself. */
function filler(ch: string, rand: () => number): string {
  if (ch >= 'a' && ch <= 'z') return pick(rand, POOLS.lower)
  if (ch >= 'A' && ch <= 'Z') return pick(rand, POOLS.upper)
  if (ch >= '0' && ch <= '9') return pick(rand, POOLS.digits)
  if (/\p{Nd}/u.test(ch)) return pick(rand, POOLS.digits)
  if (!/\p{L}/u.test(ch)) return ch
  const upper = /\p{Lu}|\p{Lt}/u.test(ch)
  for (const [script, lower, capital] of SCRIPTS) {
    if (script.test(ch)) return pick(rand, POOLS[upper ? capital : lower])
  }
  return pick(rand, upper ? POOLS.upper : POOLS.lower)
}

// ---------------------------------------------------------------------------
// Entities

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
}

function decodeEntity(entity: string): string | null {
  const body = entity.slice(1, -1)
  if (body.startsWith('#')) {
    const code =
      body[1] === 'x' || body[1] === 'X'
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10)
    return Number.isFinite(code) ? String.fromCodePoint(code) : null
  }
  return NAMED[body] ?? null
}

const decodeEntities = (value: string) =>
  value.replace(/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi, (m) => decodeEntity(m) ?? m)

const encodeText = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\u00a0/g, '&nbsp;')

function encodeAttr(value: string, quote: string, original: string): string {
  let out = value.replace(/&/g, '&amp;').replace(/\u00a0/g, '&nbsp;')
  if (quote === '"') out = out.replace(/"/g, '&quot;')
  if (quote === "'") out = out.replace(/'/g, '&#39;')
  if (/&lt;|&gt;/.test(original)) out = out.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return out
}

// ---------------------------------------------------------------------------
// What the cleanup reads from text. Scrubbing must not change these answers.

// paste.ts NOTE_MARKER: what a footnote marker looks like.
const NOTE_MARKER = /^[[(]?\s*(\d{1,4}|[a-z]|[ivxlcdm]{1,7}|[*†‡§¶#]{1,3})\s*[\])]?$/i
// paste.ts taskState: Notion's "[ ]" / "[x]" items.
const TASK = /^\s*\[[ xX]\](?=\s|$)/
// paste.ts ORDERED_MARKER: Word's typed "1." / "a)".
const ORDERED = /^\(?(\d{1,3}|[a-z]|[ivxlcdm]{1,6})[.)]$/i

const visible = (text: string) => text.replace(/\u00a0/g, ' ').trim()
const sameShape = (before: string, after: string) =>
  NOTE_MARKER.test(visible(before)) === NOTE_MARKER.test(visible(after)) &&
  TASK.test(before) === TASK.test(after) &&
  ORDERED.test(visible(before)) === ORDERED.test(visible(after))

// Text kept verbatim wherever it appears (matched on the source, entities and all).
const PROTECTED = [
  /&lt;\/?aside&gt;/y, // Notion's app clipboard writes callouts as literal <aside> text
  /\$\$[\s\S]+?\$\$/y, // TeX
  /\\\([\s\S]+?\\\)/y,
  /\\\[[\s\S]+?\\\]/y,
  /\$(?=\S)[^$\n]*?[\\^_{}][^$\n]*?(?<=\S)\$/y,
  /\[\^[^\]\s]+\]/y, // Markdown footnote markers
]
// Stops at entities that decode to quotes, brackets or spaces; trailing punctuation is trimmed.
const URL_IN_TEXT =
  /(?:https?|ftp):\/\/(?:(?!&(?:quot|nbsp|lt|gt|apos|#39|#34|#160);)[^\s<>"'\u00a0])+/y
const EMAIL_IN_TEXT = /[\w.+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/iy
const ENTITY = /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/iy
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const HAS_UUID = new RegExp(UUID.source, 'i')

// Words in ids, fragments and URL paths that are structure, not prose.
const KEEP_TOKENS = new Set(
  (
    'ftn ftnref ftnt edn ednref fn fnref ref refs cite note notes footnote footnotes footnotemark ' +
    'bib bibitem msocom msoanchor anchor com toc back backlink reference references mwt docs ' +
    'internal guid heading block tab para http https www org net html htm wiki index image images ' +
    'img file files upload uploads static assets media document edit preview view watch embed ' +
    'share user users page pages search url png jpg jpeg gif svg webp pdf'
  ).split(' ')
)
const EXTENSION =
  /\.(png|jpe?g|gif|webp|avif|bmp|svg|ico|tiff?|pdf|html?|php|aspx?|jsx?|tsx?|css|json|xml|txt|md|zip|mp4|webm|ogg|mp3|wav|swf)$/i
const YOUTUBE = /^((www|m)\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)$/
const HOSTS = [
  'example.com',
  'example.org',
  'example.net',
  'www.example.com',
  'www.example.org',
  'www.example.net',
  'cdn.example.com',
  'cdn.example.org',
]

// 1×1 images: a transparent PNG and GIF, and an empty SVG.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII='
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const SVG = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')}`

function tinyData(url: string): string {
  const mime = /^data:([^;,]*)/i.exec(url)?.[1]?.toLowerCase() ?? ''
  if (mime === 'image/gif') return GIF
  if (mime === 'image/svg+xml') return SVG
  if (mime.startsWith('image/')) return PNG
  return `data:${mime || 'text/plain'};base64,${btoa(mime.includes('html') ? '<p></p>' : 'x')}`
}

const URL_ATTRS = new Set([
  'href',
  'src',
  'resource',
  'about',
  'cite',
  'action',
  'poster',
  'data-src',
  'longdesc',
  'background',
  'xlink:href',
])
const ID_ATTRS = new Set([
  'id',
  'name',
  'for',
  'headers',
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
  'data-block-id',
  'data-x-id',
  'data-id',
  'data-footnote-id',
])
const TEXT_ATTRS = new Set([
  'alt',
  'title',
  'aria-label',
  'aria-description',
  'placeholder',
  'summary',
  'label',
  'data-mw',
  'data-title',
  'data-caption',
  'data-original-title',
])

type Mode = 'keep' | 'marker' | 'scrub'

// Math (TeX, MathML, KaTeX's rendering) and LaTeXML's generated labels stay as they are.
const KEEP_TAGS = new Set(['math', 'annotation', 'annotation-xml', 'mjx-container'])
const KEEP_CLASSES =
  /^(katex.*|ltx_Math|ltx_math_unparsed|mwe-math.*|MathJax.*|ltx_note_type|ltx_note_mark|ltx_tag(_\w+)?)$/

function isMath(el: El | null): boolean {
  for (let e = el; e && e.name !== '#root'; e = e.parent) {
    if (KEEP_TAGS.has(e.name) || e.attrs.has('data-latex')) return true
    if (e.classes.some((name) => /^(katex.*|ltx_Math|mwe-math.*|MathJax.*)$/.test(name)))
      return true
  }
  return false
}

function textMode(el: El | null): Mode {
  let marker = false
  for (let e = el; e && e.name !== '#root'; e = e.parent) {
    if (KEEP_TAGS.has(e.name) || e.attrs.has('data-latex')) return 'keep'
    if (e.classes.some((name) => KEEP_CLASSES.test(name))) return 'keep'
    if (e.name === 'code' && e.classes.some((name) => /^language-((la)?tex|math)$/.test(name)))
      return 'keep'
    if (e.name === 'a' || e.name === 'sup') marker = true
  }
  return marker ? 'marker' : 'scrub'
}

// ---------------------------------------------------------------------------
// The scrubber: one per fixture, seeded by the fixture's name.

class Scrubber {
  private readonly text: () => number
  private readonly words: () => number
  private readonly tokens = new Map<string, string>()
  private readonly hexes = new Map<string, string>()
  private readonly hosts = new Map<string, string>()

  constructor(seed: string) {
    this.text = seeded(`${seed}#text`)
    this.words = seeded(`${seed}#words`)
  }

  document(src: string): string {
    const { tokens, owner, elements } = parse(src)
    let out = ''
    let at = 0
    tokens.forEach((token, index) => {
      if (token.start !== at) throw new Error(`tokenizer gap at ${at}`)
      at = token.end
      const raw = src.slice(token.start, token.end)
      if (token.kind === 'text') out += this.textNode(raw, textMode(owner[index] ?? null))
      else if (token.kind === 'comment') out += this.comment(raw)
      else if (token.kind === 'raw') out += this.rawElement(raw, owner[index] ?? null)
      else if (token.kind === 'start') out += this.startTag(src, token, elements[index] ?? null)
      else out += raw
    })
    if (at !== src.length) throw new Error('tokenizer stopped early')
    return out
  }

  // Text ------------------------------------------------------------------

  private textNode(raw: string, mode: Mode): string {
    if (mode === 'keep') return raw
    const before = decodeEntities(raw)
    if (mode === 'marker' && NOTE_MARKER.test(visible(before))) return raw
    let out = raw
    for (let attempt = 0; attempt < 50; attempt++) {
      out = this.source(raw)
      if (sameShape(before, decodeEntities(out))) break
    }
    return out
  }

  /** Scrub text as it appears in the source: entities, TeX and URLs handled as units. */
  private source(raw: string): string {
    let out = ''
    let i = 0
    const task = TASK.exec(raw)
    if (task) {
      out = task[0]
      i = task[0].length
    }
    const at = (re: RegExp) => {
      re.lastIndex = i
      return re.exec(raw)
    }
    scan: while (i < raw.length) {
      for (const re of PROTECTED) {
        const match = at(re)
        if (match) {
          out += match[0]
          i += match[0].length
          continue scan
        }
      }
      const prev = raw[i - 1] ?? ''
      const url = /[\w/]/.test(prev) ? null : at(URL_IN_TEXT)
      if (url) {
        let text = url[0]
        while (/[.,;:!?)\]]$/.test(text) && !/&[a-z0-9#]+;$/i.test(text)) text = text.slice(0, -1)
        out += encodeText(this.urlCore(decodeEntities(text)))
        i += text.length
        continue
      }
      const email = /[\w.+-]/.test(prev) ? null : at(EMAIL_IN_TEXT)
      if (email) {
        out += this.email(email[0])
        i += email[0].length
        continue
      }
      const entity = at(ENTITY)
      if (entity) {
        const ch = decodeEntity(entity[0])
        out += ch && /[\p{L}\p{Nd}]/u.test(ch) ? filler(ch, this.text) : entity[0]
        i += entity[0].length
        continue
      }
      const ch = String.fromCodePoint(raw.codePointAt(i) as number)
      out += filler(ch, this.text)
      i += ch.length
    }
    return out
  }

  /** Scrub decoded text (attribute values, comments). */
  private plain(value: string): string {
    let out = value
    for (let attempt = 0; attempt < 50; attempt++) {
      out = decodeEntities(this.source(encodeText(value)))
      if (sameShape(value, out)) break
    }
    return out
  }

  private comment(raw: string): string {
    const body = raw.slice(4, raw.endsWith('-->') ? -3 : undefined)
    if (/^\s*(StartFragment|EndFragment)\s*$/.test(body) || /^\[if /.test(body)) return raw
    if (/^\s*notionvc:/.test(body)) return `<!--${body.replace(UUID, (uuid) => this.hex(uuid))}-->`
    return `<!--${this.plain(body)}-->`
  }

  private rawElement(raw: string, el: El | null): string {
    if (el?.name === 'style') return raw.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, this.cssUrl)
    if (raw.trim()) throw new Error(`<${el?.name}> with content: decide how to scrub it`)
    return raw
  }

  // Attributes --------------------------------------------------------------

  private startTag(src: string, token: StartTag, el: El | null): string {
    let out = ''
    let at = token.start
    for (const attr of token.attrs) {
      if (attr.start === attr.end) continue
      const decoded = decodeEntities(attr.value)
      const next = this.attribute(el, attr.name, decoded)
      if (next === null || next === decoded) continue
      out += src.slice(at, attr.start) + encodeAttr(next, attr.quote, attr.value)
      at = attr.end
    }
    return out + src.slice(at, token.end)
  }

  private attribute(el: El | null, name: string, value: string): string | null {
    if (name === 'style') return value.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, this.cssUrl)
    if (name === 'srcset') {
      return value
        .split(',')
        .map((candidate) => {
          const match = /^(\s*)(\S+)(.*)$/s.exec(candidate)
          return match ? `${match[1]}${this.url(match[2] ?? '')}${match[3]}` : candidate
        })
        .join(',')
    }
    if (el?.name === 'meta') {
      const named = el.attrs.get('name') ?? el.attrs.get('property') ?? ''
      return name === 'content' && /^(description|keywords|author|title|og:)/i.test(named)
        ? this.plain(value)
        : null
    }
    if (URL_ATTRS.has(name)) return this.url(value)
    if (ID_ATTRS.has(name)) return value.replace(/\S+/g, (part) => this.ident(part))
    if (TEXT_ATTRS.has(name)) {
      if (name === 'alt' && isMath(el)) return null
      return /^\s*(https?:)?\/\//i.test(value) ? this.url(value) : this.plain(value)
    }
    return HAS_UUID.test(value) ? value.replace(UUID, (uuid) => this.hex(uuid)) : null
  }

  private readonly cssUrl = (_: string, quote: string, url: string) =>
    `url(${quote}${this.url(url)}${quote})`

  // Identifiers and URLs ----------------------------------------------------

  /** A word mapped to the same filler every time it appears in this fixture. */
  private token(word: string): string {
    if (word.length <= 2 || KEEP_TOKENS.has(word.toLowerCase())) return word
    let out = this.tokens.get(word)
    while (out === undefined || out === word || KEEP_TOKENS.has(out.toLowerCase())) {
      out = Array.from(word, (ch) => filler(ch, this.words)).join('')
    }
    this.tokens.set(word, out)
    return out
  }

  private hex(value: string): string {
    let out = this.hexes.get(value.toLowerCase())
    if (out === undefined) {
      out = value.replace(/[0-9a-f]/gi, () => pick(this.words, POOLS.hex))
      this.hexes.set(value.toLowerCase(), out)
    }
    return /[A-F]/.test(value) && !/[a-f]/.test(value) ? out.toUpperCase() : out
  }

  /** Ids, fragments, path segments: numbers and structural words stay, the rest is mapped. */
  private ident(value: string): string {
    return value
      .replace(UUID, (uuid) => this.hex(uuid))
      .replace(/[\p{L}\p{N}]+/gu, (run) => {
        if (/^\d+$/.test(run) || this.hexes.has(run.toLowerCase())) return run
        if (/^[0-9a-f]{4,}$/i.test(run) && /\d/.test(run) && /[a-f]/i.test(run))
          return this.hex(run)
        return run.replace(/\p{L}+/gu, (word) => this.token(word))
      })
  }

  private host(host: string): string {
    const lower = host.toLowerCase()
    if (!lower || lower === 'localhost' || YOUTUBE.test(lower)) return host
    let out = this.hosts.get(lower)
    if (out === undefined) {
      out = HOSTS[this.hosts.size] ?? `h${this.hosts.size}.example.com`
      this.hosts.set(lower, out)
    }
    return out
  }

  private email(address: string): string {
    const at = address.lastIndexOf('@')
    return `${this.ident(address.slice(0, at))}@${this.host(address.slice(at + 1))}`
  }

  private url(raw: string): string {
    const lead = /^\s*/.exec(raw)?.[0] ?? ''
    const trail = /\s*$/.exec(raw.slice(lead.length))?.[0] ?? ''
    const url = raw.slice(lead.length, raw.length - trail.length)
    return url ? `${lead}${this.urlCore(url)}${trail}` : raw
  }

  private urlCore(url: string): string {
    if (url.startsWith('#')) return `#${this.ident(url.slice(1))}`
    if (/^data:/i.test(url)) return tinyData(url)
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase()
    if (scheme === 'mailto') return `mailto:${this.email(url.slice(7).split('?')[0] ?? '')}`
    if (scheme === 'tel') return 'tel:+10000000000'
    if (scheme === 'javascript') return 'javascript:void(0)'
    if (scheme === 'attachment') {
      const [, id = '', ...name] = url.split(':')
      return `attachment:${this.ident(id)}:${this.path(name.join(':'))}`
    }
    const parts = /^([a-z][a-z0-9+.-]*:)?(\/\/[^/?#]*)?([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(url)
    if (!parts) return this.ident(url)
    const [, prefix = '', authority, path = '', query, fragment] = parts
    let out = prefix
    if (authority !== undefined) {
      const hostPort = /^\/\/(?:[^@]*@)?([^:]*)(:\d+)?$/.exec(authority)
      out += hostPort ? `//${this.host(hostPort[1] ?? '')}${hostPort[2] ?? ''}` : authority
    }
    out += this.path(path)
    if (query !== undefined) out += `?${this.query(query.slice(1))}`
    if (fragment !== undefined) out += `#${this.ident(fragment.slice(1))}`
    return out
  }

  private path(path: string): string {
    return path
      .split('/')
      .map((segment) => {
        const decoded = safeDecode(segment)
        const extension = EXTENSION.exec(decoded)?.[0] ?? ''
        const out = this.ident(decoded.slice(0, decoded.length - extension.length)) + extension
        return decoded === segment ? out : encodeURIComponent(out)
      })
      .join('/')
  }

  private query(query: string): string {
    return query
      .split('&')
      .map((pair) => {
        const eq = pair.indexOf('=')
        if (eq === -1) return this.ident(pair)
        const value = pair.slice(eq + 1)
        const decoded = safeDecode(value.replace(/\+/g, ' '))
        const out = /^(https?:)?\/\//i.test(decoded) ? this.urlCore(decoded) : this.ident(decoded)
        return `${this.ident(pair.slice(0, eq))}=${decoded === value ? out : encodeURIComponent(out)}`
      })
      .join('&')
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// ---------------------------------------------------------------------------
// Verification: same DOM shape, same text shape, same answers to what the cleanup asks.

const parseDoc = (html: string) => new DOMParser().parseFromString(html, 'text/html')

function shapeOf(text: string): string[] {
  return text.split(/(\s+)/).map((part) => {
    if (/^\s*$/.test(part) || part.includes('://') || part.includes('@')) return part ? '·' : ''
    return Array.from(part, (ch) => {
      if (/\p{Lu}/u.test(ch)) return 'A'
      if (/\p{Ll}/u.test(ch)) return 'a'
      if (/\p{L}/u.test(ch)) return 'L'
      if (/\p{Nd}/u.test(ch)) return '0'
      return ch
    }).join('')
  })
}

function verify(name: string, before: string, after: string) {
  const fail = (path: string, why: string, detail = '') => {
    throw new Error(`${name}: ${why} at ${path}${detail}`)
  }
  const walk = (a: Node, b: Node, path: string) => {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) fail(path, 'node differs')
    if (a.nodeType === 3) {
      const [x, y] = [a.nodeValue ?? '', b.nodeValue ?? '']
      const detail = `\n  ${JSON.stringify(shapeOf(x).join(''))}\n  ${JSON.stringify(shapeOf(y).join(''))}`
      const ws = (s: string) => s.replace(/\S+/g, '·')
      if (ws(x) !== ws(y)) fail(path, 'whitespace layout differs', detail)
      if (shapeOf(x).join('') !== shapeOf(y).join('')) fail(path, 'text shape differs', detail)
    }
    if (a.nodeType === 1) {
      const [x, y] = [a as Element, b as Element]
      const names = (el: Element) => Array.from(el.attributes, (attr) => attr.name).join(' ')
      if (names(x) !== names(y)) fail(path, 'attributes differ')
      if (/^(a|sup)$/i.test(x.tagName)) {
        const markers = [x, y].map((el) => NOTE_MARKER.test(visible(el.textContent ?? '')))
        if (markers[0] !== markers[1]) fail(path, 'note marker changed')
      }
      if (
        /^li$/i.test(x.tagName) &&
        TASK.test(x.textContent ?? '') !== TASK.test(y.textContent ?? '')
      )
        fail(path, 'task marker changed')
    }
    if (a.childNodes.length !== b.childNodes.length) fail(path, 'child count differs')
    a.childNodes.forEach((child, i) => {
      walk(child, b.childNodes[i] as Node, `${path}/${child.nodeName}[${i}]`)
    })
  }
  walk(parseDoc(before).documentElement, parseDoc(after).documentElement, 'html')
}

// Text the scrubber keeps on purpose: math and LaTeXML's generated labels and marks.
const KEPT =
  'math, .katex, .ltx_Math, .ltx_note_type, .ltx_note_mark, .ltx_tag, [data-latex], code[class*="language-latex"]'

/**
 * What is left of the source's prose. `survivors`: source words (3+ letters) still
 * at the same place in the same text node or text attribute (verify() has already
 * aligned the two documents). `trigrams`: three consecutive source prose words found
 * anywhere in the fixture, in any text node or attribute value.
 */
function leaks(before: string, after: string) {
  const [a, b] = [parseDoc(before), parseDoc(after)]
  const texts = (doc: Document) => {
    const out: Text[] = []
    const walker = doc.createTreeWalker(doc.documentElement, 4)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) out.push(node as Text)
    return out
  }
  const [from, to] = [texts(a), texts(b)]
  const [fromEls, toEls] = [a, b].map((doc) => Array.from(doc.querySelectorAll('*')))
  const pairs: Array<[string, string]> = []
  from.forEach((node, i) => {
    if (!node.parentElement?.closest(KEPT))
      pairs.push([node.nodeValue ?? '', to[i]?.nodeValue ?? ''])
  })
  fromEls.forEach((el, i) => {
    for (const name of TEXT_ATTRS) {
      const value = el.getAttribute(name)
      if (value !== null && !el.closest(KEPT))
        pairs.push([value, toEls[i]?.getAttribute(name) ?? ''])
    }
  })
  const survivors = new Set<string>()
  for (const [x, y] of pairs) {
    const ys = y.split(/\s+/)
    x.split(/\s+/).forEach((word, k) => {
      if (/\p{L}{3}/u.test(word) && word === ys[k]) survivors.add(word)
    })
  }
  const words = (list: string[]) => list.flatMap((t) => t.toLowerCase().match(/\p{L}+/gu) ?? [])
  const trigrams = (list: string[]) =>
    new Set(list.slice(2).map((word, i) => `${list[i]} ${list[i + 1]} ${word}`))
  const source = words(pairs.map(([x]) => x))
  const fixture = words([
    ...to.map((node) => node.nodeValue ?? ''),
    ...toEls.flatMap((el) =>
      Array.from(el.attributes)
        .filter((attr) => !/^(style|class)$/.test(attr.name))
        .map((attr) => attr.value)
    ),
  ])
  const fixtureTrigrams = trigrams(fixture)
  return {
    words: new Set(source.filter((word) => word.length >= 3)).size,
    survivors: [...survivors],
    trigrams: [...trigrams(source)].filter((tri) => fixtureTrigrams.has(tri)),
  }
}

// ---------------------------------------------------------------------------
// Driver

function build(spec: Spec) {
  const original = readFileSync(join(CORPUS_ROOT, spec.from), 'utf8')
  const sha256 = createHash('sha256').update(original).digest('hex')
  if (sha256 !== spec.sha256) throw new Error(`${spec.from} changed (sha256 ${sha256})`)
  let pruned = original
  for (const rule of spec.prune ?? []) pruned = prune(pruned, rule)
  const html = new Scrubber(spec.out).document(pruned)
  verify(spec.out, pruned, html)
  return { original, pruned, html }
}

function outline(spec: Spec, selector?: string, nth = 0) {
  let src = readFileSync(join(CORPUS_ROOT, spec.from), 'utf8')
  const rules = selector
    ? [{ container: selector, nth, keep: [] }]
    : spec.prune?.length
      ? spec.prune
      : [{ container: 'body', keep: [] }]
  for (const rule of rules) {
    console.log(`\n${rule.container}${rule.nth ? ` (#${rule.nth})` : ''}`)
    const container = domContainer(src, rule)
    Array.from(container.children).forEach((child, index) => {
      const html = child.outerHTML.replace(/data:[^"')\s]+/g, PNG)
      const count = (selector: string) =>
        child.querySelectorAll(selector).length + (child.matches(selector) ? 1 : 0)
      const features = Object.entries({
        math: count('math, .katex'),
        eqgroup: count('.ltx_equationgroup'),
        note: count('.ltx_note'),
        cite: count('cite'),
        sup: count('sup'),
        code: count('pre, code'),
        mono: (html.match(/font-family:[^;"]*(mono|courier|consolas|menlo)/gi) ?? []).length,
        highlight: (html.match(/background-color:\s*(#(?!ffffff)[0-9a-f]{6}|rgb\()/gi) ?? [])
          .length,
        img: count('img'),
        table: count('table'),
        hr: count('hr'),
        li: count('li'),
        todo: count('.notion-to_do-block, input[type="checkbox"]'),
        strike: (html.match(/line-through/g) ?? []).length,
        link: count('a[href]'),
      })
        .filter(([, n]) => n > 0)
        .map(([key, n]) => `${key}:${n}`)
        .join(' ')
      const label = `${child.tagName.toLowerCase()}${child.id ? `#${child.id}` : ''}`
      console.log(
        `${String(index).padStart(4)} ${label.padEnd(28)} ${String(html.length).padStart(7)}  ${features}`
      )
    })
    if (!selector) src = prune(src, rule)
  }
}

function main() {
  const args = process.argv.slice(2)
  if (!existsSync(CORPUS_ROOT)) {
    console.error(`No corpus at ${CORPUS_ROOT} (set LEMMA_PASTE_CORPUS).`)
    process.exit(1)
  }
  if (args[0] === '--outline') {
    const spec = SPECS.find((s) => s.out === args[1])
    if (!spec)
      throw new Error(`Unknown fixture ${args[1]}; one of:\n${SPECS.map((s) => s.out).join('\n')}`)
    return outline(spec, args[2], Number(args[3] ?? 0))
  }
  const check = args.includes('--check')
  let drift = 0
  console.log(`${'fixture'.padEnd(54)}  source fixture  words survivors trigrams`)
  for (const spec of SPECS) {
    const { original, pruned, html } = build(spec)
    const path = join(OUT, spec.out)
    if (check) {
      if (!existsSync(path) || readFileSync(path, 'utf8') !== html) {
        console.error(`DRIFT ${spec.out}`)
        drift++
      }
    } else {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, html)
    }
    const report = leaks(pruned, html)
    console.log(
      [
        spec.out.padEnd(54),
        String(original.length).padStart(7),
        String(html.length).padStart(7),
        String(report.words).padStart(6),
        String(report.survivors.length).padStart(9),
        String(report.trigrams.length).padStart(8),
      ].join(' ')
    )
    if (report.survivors.length > 0) console.log(`    survivors: ${report.survivors.join(' ')}`)
    if (report.trigrams.length > 0) console.log(`    trigrams: ${report.trigrams.join(' | ')}`)
  }
  if (drift > 0) process.exit(1)
}

main()
