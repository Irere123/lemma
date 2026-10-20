import { BlockMath, InlineMath } from '@tiptap/extension-mathematics'

// Pasted math arrives in a few shapes. Each rule pulls the TeX source back out
// so the equation stays editable instead of becoming duplicated text:
//   KaTeX (ChatGPT, many blogs)   <span class="katex">…<annotation encoding="application/x-tex">
//   MathML (arXiv/LaTeXML, Word)  <math alttext="…">…<annotation encoding="application/x-tex">
//   Wikipedia                     <span class="mwe-math-element">…<math alttext="{\displaystyle …}">
//   Lemma's legacy math node      <span data-type="math">…</span>

const MATH_PRIORITY = 1000

function unwrapDisplayStyle(tex: string): string {
  const trimmed = tex.trim()
  const match = /^\{\\displaystyle\s*([\s\S]*)\}$/.exec(trimmed)
  return (match?.[1] ?? trimmed).trim()
}

function texFrom(element: Element): string | null {
  const annotation = element.querySelector('annotation[encoding="application/x-tex"]')
  const fromAnnotation = annotation?.textContent?.trim()
  if (fromAnnotation) return unwrapDisplayStyle(fromAnnotation)

  const math = element.localName === 'math' ? element : element.querySelector('math')
  const alt = math?.getAttribute('alttext')?.trim()
  if (alt) return unwrapDisplayStyle(alt)

  const img = element.localName === 'img' ? element : element.querySelector('img')
  const imgAlt = img?.getAttribute('alt')?.trim()
  if (imgAlt && /\\|\^|_|\{/.test(imgAlt)) return unwrapDisplayStyle(imgAlt)

  return null
}

function isDisplay(element: Element): boolean {
  if (element.classList.contains('katex-display')) return true
  if (element.closest('.katex-display')) return true
  const math = element.localName === 'math' ? element : element.querySelector('math')
  if (math?.getAttribute('display') === 'block') return true
  return (
    element.querySelector('.mwe-math-mathml-display, .mwe-math-fallback-image-display') !== null
  )
}

// LaTeXML lays an aligned group out as one table row per line and one cell per
// alignment column, repeating \displaystyle in every cell. Rebuild the environment
// so "lhs | = rhs" stays on one line.
function equationGroupTex(table: Element): string | null {
  const rows = Array.from(table.querySelectorAll('tr'))
    .map((row) =>
      Array.from(row.querySelectorAll('math'))
        .map((math) => texFrom(math)?.replace(/^\\displaystyle(?![a-zA-Z])\s*/, ''))
        .filter((tex): tex is string => Boolean(tex))
    )
    .filter((cells) => cells.length > 0)
  if (rows.length === 0) return null
  const aligned = rows.some((cells) => cells.length > 1)
  const lines = rows.map((cells) => cells.join(aligned ? ' & ' : ' '))
  if (lines.length === 1 && !aligned) return lines[0] ?? null
  const env = aligned ? 'aligned' : 'gathered'
  return `\\begin{${env}}${lines.join(' \\\\ ')}\\end{${env}}`
}

const latexAttrs = (want: 'inline' | 'block') => (node: HTMLElement | string) => {
  if (typeof node === 'string') return false
  const latex = texFrom(node)
  if (!latex) return false
  if ((want === 'block') !== isDisplay(node)) return false
  return { latex }
}

const pastedMathRules = (want: 'inline' | 'block') => [
  { tag: 'span.katex-display', priority: MATH_PRIORITY, getAttrs: latexAttrs(want) },
  { tag: 'span.katex', priority: MATH_PRIORITY, getAttrs: latexAttrs(want) },
  { tag: 'span.mwe-math-element', priority: MATH_PRIORITY, getAttrs: latexAttrs(want) },
  {
    tag: 'img.mwe-math-fallback-image-inline',
    priority: MATH_PRIORITY,
    getAttrs: latexAttrs(want),
  },
  {
    tag: 'img.mwe-math-fallback-image-display',
    priority: MATH_PRIORITY,
    getAttrs: latexAttrs(want),
  },
  { tag: 'math', priority: MATH_PRIORITY, getAttrs: latexAttrs(want) },
]

export const MathInline = InlineMath.extend({
  parseHTML() {
    return [
      ...(this.parent?.() ?? []),
      {
        tag: 'span[data-type="math"]',
        priority: MATH_PRIORITY,
        getAttrs: (node: HTMLElement | string) =>
          typeof node === 'string'
            ? false
            : { latex: node.getAttribute('data-latex') ?? node.textContent ?? '' },
      },
      ...pastedMathRules('inline'),
    ]
  },
})

export const MathBlock = BlockMath.extend({
  parseHTML() {
    return [
      ...(this.parent?.() ?? []),
      // LaTeXML wraps display equations (and their "(1)" tags) in a table.
      {
        tag: 'table.ltx_equation',
        priority: MATH_PRIORITY,
        getAttrs: (node: HTMLElement | string) => {
          if (typeof node === 'string') return false
          const latex = texFrom(node)
          return latex ? { latex } : false
        },
      },
      {
        tag: 'table.ltx_equationgroup',
        priority: MATH_PRIORITY,
        getAttrs: (node: HTMLElement | string) => {
          if (typeof node === 'string') return false
          const latex = equationGroupTex(node)
          return latex ? { latex } : false
        },
      },
      ...pastedMathRules('block'),
    ]
  },
})
