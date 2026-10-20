import Code from '@tiptap/extension-code'
import Highlight from '@tiptap/extension-highlight'
import { Color } from '@tiptap/extension-text-style'

import { safeCssColor } from '../sanitize'

// Colours that only restate the default ink or paper. Google Docs and Word put
// one on every run of text; keeping them would freeze black text into the
// document and make it unreadable in dark mode.
const DEFAULT_INK =
  /^(#000(000)?|black|rgb\(0,\s*0,\s*0\)|windowtext|inherit|initial|currentcolor)$/i
const DEFAULT_PAPER =
  /^(#fff(fff)?|white|transparent|rgba\(0,\s*0,\s*0,\s*0\)|rgb\(255,\s*255,\s*255\)|window|inherit|initial)$/i

export const MONOSPACE =
  /(^|[\s,'"])(monospace|courier( new)?|consolas|menlo|monaco|roboto mono|source code pro|fira (code|mono)|jetbrains mono|sf ?mono(-regular)?|ubuntu mono|inconsolata|lucida console|cascadia (code|mono)|ibm plex mono|(dejavu|liberation|noto|droid) (sans )?mono|pt mono|andale mono)\b/i

// Browsers report inline colours as rgb(); store the hex the editor writes.
function normalizeColor(raw: string): string {
  const rgb =
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(1|1\.0+)\s*)?\)$/i.exec(raw)
  if (!rgb) return raw
  return `#${rgb
    .slice(1, 4)
    .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, '0'))
    .join('')}`
}

export const TextColor = Color.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          color: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              // Lemma's own HTML states the stored colour exactly.
              const stated = element.getAttribute('data-color')
              if (stated !== null) return safeCssColor(stated)
              // TextStyle copies a span's style onto the spans inside it (e.g.
              // an inline-math span); there the colour is the outer one's.
              const outer = element.parentElement?.closest<HTMLElement>('span[data-color]')
              if (outer && outer.style.color === element.style.color) {
                return safeCssColor(outer.getAttribute('data-color'))
              }
              const raw = element.style.color?.replace(/['"]+/g, '').trim()
              if (!raw || DEFAULT_INK.test(raw)) return null
              return safeCssColor(normalizeColor(raw))
            },
            renderHTML: (attributes: Record<string, unknown>) => {
              const color = safeCssColor(attributes.color)
              return color ? { style: `color: ${color}` } : {}
            },
          },
        },
      },
    ]
  },
})

export const TextHighlight = Highlight.extend({
  addAttributes() {
    const parent: Record<string, object> = this.parent?.() ?? {}
    return {
      ...parent,
      color: {
        ...parent.color,
        // A bare <mark> has no background colour: that's null, not "".
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-color') || element.style.backgroundColor || null,
      },
    }
  },

  parseHTML() {
    return [
      ...(this.parent?.() ?? []),
      {
        // Google Docs and Word mark highlights as a background colour on a span.
        tag: 'span',
        consuming: false,
        getAttrs: (node: HTMLElement | string) => {
          if (typeof node === 'string') return false
          const raw = (node.style.backgroundColor || '').trim()
          if (!raw || DEFAULT_PAPER.test(raw)) return false
          const color = safeCssColor(normalizeColor(raw))
          return color ? { color } : false
        },
      },
    ]
  },
}).configure({ multicolor: true })

export const InlineCode = Code.extend({
  parseHTML() {
    return [
      ...(this.parent?.() ?? []),
      {
        // Google Docs (and Word) "code" is just a monospace font on a span.
        tag: 'span',
        consuming: false,
        getAttrs: (node: HTMLElement | string) => {
          if (typeof node === 'string') return false
          if (node.closest('pre')) return false
          return MONOSPACE.test(node.style.fontFamily || '') ? null : false
        },
      },
      { tag: 'kbd' },
      { tag: 'samp' },
      { tag: 'tt' },
    ]
  },
})
