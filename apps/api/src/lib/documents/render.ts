import {
  type ContentDoc,
  type EmailRenderOptions,
  type RenderOptions,
  renderToEmail,
  renderToHTML,
} from '@lemma/content'
import katex from 'katex'

import { highlightCode } from './highlight'

// KaTeX runs here, at save time, so readers get finished math in the HTML and
// only need katex.css — no math library ships to the reading page.

function katexHtml(latex: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
    })
  } catch {
    return null
  }
}

// Email clients can't load KaTeX's CSS or fonts. MathML renders natively in
// Apple Mail and Thunderbird; elsewhere its text still reads in order. The TeX
// annotation is dropped so clients without MathML don't print it twice.
function katexMathml(latex: string, displayMode: boolean): string | null {
  try {
    return katex
      .renderToString(latex, { displayMode, throwOnError: false, output: 'mathml' })
      .replace(/<annotation encoding="application\/x-tex">[\s\S]*?<\/annotation>/g, '')
  } catch {
    return null
  }
}

/** Citations and document links come from render-context.ts. */
type DocumentRenderOptions = Pick<RenderOptions, 'citations' | 'documentLink'>

export const renderPublishedHtml = (
  content: ContentDoc | null | undefined,
  options: DocumentRenderOptions = {}
) => renderToHTML(content, { ...options, renderMath: katexHtml, highlightCode })

export const renderEmailHtml = (
  content: ContentDoc | null | undefined,
  options: Pick<EmailRenderOptions, 'citations' | 'documentLink'> = {}
) => renderToEmail(content, { ...options, renderMath: katexMathml })
