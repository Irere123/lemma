import { mergeAttributes, Node } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'

// Research writing: figures with captions, citations, a generated bibliography
// and cross-references. Numbers ("Figure 3", "Eq. (4)") and formatted citations
// are never stored: they're derived from document order and the writer's
// reference library when rendering, so they stay right through any edit.

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figure: {
      /** Wrap the selected image or table in a figure with an empty caption. */
      wrapInFigure: () => ReturnType
      /** Turn the figure around the selection back into its plain content. */
      unwrapFigure: () => ReturnType
    }
  }
}

/** One source in a citation, as stored: the reference's library id plus the pin cite. */
export type CitationItem = {
  id: string
  locator?: string
  label?: string
  prefix?: string
  suffix?: string
}

export type CitationMode = 'normal' | 'suppress-author' | 'author-in-text'

const CITATION_MODES: CitationMode[] = ['normal', 'suppress-author', 'author-in-text']

const FIGURE_CONTENT = new Set(['image', 'table'])

/** The one image or table a pasted <figure> shows, or null if it isn't exactly one. */
function figureMedia(figure: HTMLElement): Element | null {
  // Nested figures are sub-figure grids.
  if (figure.querySelector('figure')) return null
  const insideFigure = (element: Element | null | undefined) =>
    Boolean(element && element !== figure && figure.contains(element))
  const outsideCaption = (element: Element) => !insideFigure(element.closest('figcaption'))
  // Tables of the figure itself, not tables nested in its cells.
  const tables = Array.from(figure.querySelectorAll('table')).filter(
    (table) => outsideCaption(table) && !insideFigure(table.parentElement?.closest('table'))
  )
  if (tables.length === 1) return tables[0] ?? null
  if (tables.length > 1) return null
  const images = Array.from(figure.querySelectorAll('img')).filter(outsideCaption)
  return images.length === 1 ? (images[0] ?? null) : null
}

// Captions as rendered carry a generated label ("Figure 3.") before the text
// the writer typed; on re-import only the writer's text is content.
function captionText(element: HTMLElement): HTMLElement {
  const typed = element.querySelector<HTMLElement>(':scope > .figure-caption')
  if (typed) return typed
  if (!element.querySelector(':scope > .figure-label')) return element
  // Label only: an empty caption.
  return element.ownerDocument.createElement('span')
}

export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  content: '(image | table) figcaption',
  defining: true,
  isolating: true,
  draggable: true,

  parseHTML() {
    return [
      {
        tag: 'figure',
        // Only a figure of one image or one table becomes a figure; a grid of
        // sub-figures (or a figure of text) stays plain blocks plus its caption.
        getAttrs: (element: HTMLElement | string) =>
          typeof element !== 'string' &&
          !element.parentElement?.closest('figure') &&
          figureMedia(element)
            ? null
            : false,
        // Schema order is content then caption; sources put table captions first.
        contentElement: (element: HTMLElement) => {
          const box = element.ownerDocument.createElement('div')
          const media = figureMedia(element)
          if (media) box.appendChild(media.cloneNode(true))
          const caption = element.querySelector('figcaption')?.cloneNode(true) as
            | Element
            | undefined
          // LaTeXML spells the number out ("Figure 1: …"); ours is generated.
          for (const tag of caption?.querySelectorAll('.ltx_tag') ?? []) tag.remove()
          if (caption) box.appendChild(caption)
          return box
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-figure': '' }), 0]
  },

  addCommands() {
    return {
      wrapInFigure:
        () =>
        ({ state, tr, dispatch }) => {
          const { selection, schema } = state
          const figure = schema.nodes.figure
          const caption = schema.nodes.figcaption
          if (!figure || !caption) return false
          // The selected node, or the table the caret is in.
          let pos: number | null = null
          let node: PMNode | null = null
          if (selection instanceof NodeSelection && FIGURE_CONTENT.has(selection.node.type.name)) {
            pos = selection.from
            node = selection.node
          } else {
            const { $from } = selection
            for (let depth = $from.depth; depth > 0; depth--) {
              const candidate = $from.node(depth)
              if (candidate.type.name === 'figure') return false
              if (FIGURE_CONTENT.has(candidate.type.name)) {
                pos = $from.before(depth)
                node = candidate
                break
              }
            }
          }
          if (pos === null || !node) return false
          if (state.doc.resolve(pos).parent.type.name === 'figure') return false
          if (dispatch) {
            tr.replaceWith(pos, pos + node.nodeSize, figure.create(null, [node, caption.create()]))
            dispatch(tr)
          }
          return true
        },
      unwrapFigure:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection
          for (let depth = $from.depth; depth > 0; depth--) {
            const candidate = $from.node(depth)
            if (candidate.type.name !== 'figure') continue
            const pos = $from.before(depth)
            const content = candidate.firstChild
            if (!content) return false
            if (dispatch) {
              tr.replaceWith(pos, pos + candidate.nodeSize, content)
              dispatch(tr)
            }
            return true
          }
          return false
        },
    }
  },
})

export const Figcaption = Node.create({
  name: 'figcaption',
  content: 'inline*',
  defining: true,

  parseHTML() {
    // Only inside a figure; a caption of something that isn't one stays a paragraph.
    return [{ tag: 'figcaption', context: 'figure/', contentElement: captionText }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['figcaption', HTMLAttributes, 0]
  },
})

function parseItems(element: HTMLElement): CitationItem[] {
  try {
    const parsed = JSON.parse(element.getAttribute('data-items') ?? '[]') as unknown
    return Array.isArray(parsed) ? (parsed as CitationItem[]) : []
  } catch {
    return []
  }
}

export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      items: {
        default: [],
        parseHTML: parseItems,
        renderHTML: (attributes) => ({ 'data-items': JSON.stringify(attributes.items ?? []) }),
      },
      mode: {
        default: 'normal',
        parseHTML: (element) => {
          const mode = element.getAttribute('data-mode') as CitationMode | null
          return mode && CITATION_MODES.includes(mode) ? mode : 'normal'
        },
        renderHTML: (attributes) =>
          attributes.mode && attributes.mode !== 'normal' ? { 'data-mode': attributes.mode } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-citation]', priority: 1000 }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-citation': '', class: 'citation' })]
  },

  renderText() {
    return ''
  },
})

export const Bibliography = Node.create({
  name: 'bibliography',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      title: {
        default: 'References',
        parseHTML: (element) =>
          element.getAttribute('data-title') ??
          element.querySelector(':scope > h2')?.textContent?.trim() ??
          'References',
        renderHTML: (attributes) => ({ 'data-title': attributes.title as string }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-bibliography]', priority: 1000 }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes, { 'data-bibliography': '' })]
  },
})

export const CrossReference = Node.create({
  name: 'crossReference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      target: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('data-target') ||
          element.getAttribute('href')?.replace(/^#/, '') ||
          null,
        renderHTML: (attributes) =>
          attributes.target ? { 'data-target': attributes.target as string } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-cross-ref]', priority: 1000 }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(HTMLAttributes, { 'data-cross-ref': '' })]
  },

  renderText() {
    return ''
  },
})
