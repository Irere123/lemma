import { escapeHtml } from '@lemma/content'
import { common, createLowlight } from 'lowlight'

// The same highlighter (and language set) as the editor, so a published code
// block is coloured exactly as it was while writing.
const lowlight = createLowlight(common)

type HastNode =
  | { type: 'text'; value: string }
  | { type: 'element'; properties?: { className?: string[] }; children: HastNode[] }
  | { type: 'root'; children: HastNode[] }

// lowlight's tree is text and <span class="hljs-…">; anything else is dropped.
function toHtml(node: HastNode): string {
  if (node.type === 'text') return escapeHtml(node.value)
  const inner = node.children.map(toHtml).join('')
  if (node.type === 'root') return inner
  const classes = (node.properties?.className ?? []).filter((name) => /^[\w-]+$/.test(name))
  return classes.length > 0 ? `<span class="${classes.join(' ')}">${inner}</span>` : inner
}

export function highlightCode(code: string, language: string): string | null {
  if (!lowlight.registered(language)) return null
  try {
    return toHtml(lowlight.highlight(language, code) as unknown as HastNode)
  } catch {
    return null
  }
}
