import {
  type CitationCluster,
  type CslItem,
  createCitationProcessor,
  STYLES,
  type StyleId,
} from '@lemma/content/citations'
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { type EditorState, Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

/**
 * Numbers, labels and formatted citations in the editor, as decorations (the
 * document stores none of them): "Figure 2." before a caption, "(3)" beside a
 * numbered equation, a cross-reference's "Table 1", a citation's "(Smith,
 * 2020)", a link's current title. They follow the same rules as the
 * published page (@lemma/content's numbering and citation processor).
 *
 * Recomputed after a short pause rather than on every keystroke, so their cost
 * never lands on typing; between recomputes they're mapped through edits.
 */

export type TargetSummary = {
  id: string
  kind: 'figure' | 'table' | 'equation' | 'heading' | 'footnote'
  label: string
  text: string
  pos: number
  /** Headings only. */
  level?: number
}

export type BibliographyEntry = { id: string; html: string; number?: number }

export type ResearchStorage = {
  library: Map<string, CslItem>
  style: StyleId
  /** Current titles of linked documents, by id (stored titles are the fallback). */
  titles: Map<string, string>
  targets: TargetSummary[]
  bibliography: BibliographyEntry[]
  missing: string[]
  /** Listeners for bibliography/target changes (the bibliography node view, pickers). */
  listeners: Set<() => void>
}

type PluginState = { decorations: DecorationSet; stale: boolean }

export const researchKey = new PluginKey<PluginState>('research')

const REFRESH_DELAY_MS = 150

function compute(doc: PMNode, storage: ResearchStorage): DecorationSet {
  const decorations: Decoration[] = []
  const targets = new Map<string, TargetSummary>()
  const crossRefs: { pos: number; node: PMNode }[] = []
  const citations: { pos: number; node: PMNode }[] = []
  let figures = 0
  let tables = 0
  let equations = 0
  let notes = 0

  doc.descendants((node, pos) => {
    const id = typeof node.attrs.id === 'string' ? node.attrs.id : null
    switch (node.type.name) {
      case 'figure': {
        const isTable = node.firstChild?.type.name === 'table'
        const label = `${isTable ? 'Table' : 'Figure'} ${isTable ? ++tables : ++figures}`
        const caption = node.lastChild
        if (caption?.type.name === 'figcaption') {
          const at = pos + node.nodeSize - 1 - caption.nodeSize
          decorations.push(
            Decoration.node(at, at + caption.nodeSize, {
              'data-label': `${label}.`,
              class: caption.content.size === 0 ? 'is-empty-caption' : '',
            })
          )
        }
        if (id) {
          targets.set(id, {
            id,
            kind: isTable ? 'table' : 'figure',
            label,
            text: caption?.textContent ?? '',
            pos,
          })
        }
        return true
      }
      case 'blockMath': {
        if (node.attrs.numbered !== true) return false
        const tag =
          typeof node.attrs.tag === 'string' && node.attrs.tag.trim() ? node.attrs.tag.trim() : null
        const number = tag ?? String(++equations)
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, { 'data-number': `(${number})` })
        )
        if (id) {
          targets.set(id, {
            id,
            kind: 'equation',
            label: `Eq. (${number})`,
            text: node.attrs.latex ?? '',
            pos,
          })
        }
        return false
      }
      case 'heading': {
        if (id) {
          const text = node.textContent.trim()
          targets.set(id, {
            id,
            kind: 'heading',
            label: text || 'Untitled section',
            text,
            pos,
            level: Number(node.attrs.level) || 1,
          })
        }
        return true
      }
      case 'footnoteReference': {
        const noteId = node.attrs.id
        if (typeof noteId === 'string' && !targets.has(noteId)) {
          targets.set(noteId, {
            id: noteId,
            kind: 'footnote',
            label: `note ${++notes}`,
            text: '',
            pos,
          })
        }
        return false
      }
      case 'crossReference':
        crossRefs.push({ pos, node })
        return false
      case 'citation':
        citations.push({ pos, node })
        return false
      case 'documentLink': {
        const title = storage.titles.get(node.attrs.documentId) ?? node.attrs.title ?? ''
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, {
            'data-label': title || 'Untitled',
            class:
              storage.titles.has(node.attrs.documentId) || !storage.titles.size ? '' : 'is-missing',
          })
        )
        return false
      }
      default:
        // Text has nothing to number; skipping it keeps the walk cheap.
        return !node.isText
    }
  })

  for (const { pos, node } of crossRefs) {
    const target = targets.get(node.attrs.target)
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        'data-label': target?.label ?? 'missing reference',
        class: target ? '' : 'is-missing',
      })
    )
  }

  if (citations.length > 0) {
    const clusters: CitationCluster[] = citations.map(({ node }) => ({
      items: Array.isArray(node.attrs.items) ? node.attrs.items : [],
      mode: node.attrs.mode,
    }))
    const result = createCitationProcessor(storage.style, [...storage.library.values()]).process(
      clusters
    )
    const superscript = storage.style === 'nature'
    citations.forEach(({ pos, node }, index) => {
      const rendered = result.clusters[index]
      const missing = (clusters[index]?.items ?? []).some((item) => !storage.library.has(item.id))
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          'data-label': rendered?.text ?? '(citation)',
          class: [
            superscript ? 'is-superscript' : '',
            missing && storage.library.size > 0 ? 'is-missing' : '',
          ]
            .filter(Boolean)
            .join(' '),
        })
      )
    })
    storage.bibliography = result.bibliography
    storage.missing = result.missing
  } else {
    storage.bibliography = []
    storage.missing = []
  }

  storage.targets = [...targets.values()]
  // Listeners update React state and node views; never during a dispatch.
  queueMicrotask(() => {
    for (const listener of storage.listeners) listener()
  })
  return DecorationSet.create(doc, decorations)
}

/** Recompute now (after the library, style or linked titles change). */
export function refreshResearch(view: EditorView) {
  view.dispatch(view.state.tr.setMeta(researchKey, 'refresh'))
}

export const Research = Extension.create<
  {
    onOpenDocument: (id: string, blockId: string | null) => void
    onEditCitation: (pos: number) => void
  },
  ResearchStorage
>({
  name: 'research',

  addOptions() {
    return { onOpenDocument: () => {}, onEditCitation: () => {} }
  },

  addStorage() {
    return {
      library: new Map(),
      style: 'apa',
      titles: new Map(),
      targets: [],
      bibliography: [],
      missing: [],
      listeners: new Set(),
    }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    const options = this.options
    return [
      new Plugin<PluginState>({
        key: researchKey,
        state: {
          init: (_, state: EditorState) => ({
            decorations: compute(state.doc, storage),
            stale: false,
          }),
          apply: (tr, value, _old, state) => {
            if (tr.getMeta(researchKey) === 'refresh') {
              return { decorations: compute(state.doc, storage), stale: false }
            }
            if (!tr.docChanged) return value
            return { decorations: value.decorations.map(tr.mapping, tr.doc), stale: true }
          },
        },
        props: {
          decorations: (state) => researchKey.getState(state)?.decorations,
          handleClickOn: (_view, _pos, node, nodePos, event) => {
            if (node.type.name === 'documentLink' && node.attrs.documentId) {
              event.preventDefault()
              options.onOpenDocument(node.attrs.documentId, node.attrs.blockId ?? null)
              return true
            }
            if (node.type.name === 'citation') {
              options.onEditCitation(nodePos)
              return true
            }
            if (node.type.name === 'crossReference' && (event.metaKey || event.ctrlKey)) {
              const target = storage.targets.find((entry) => entry.id === node.attrs.target)
              if (!target) return false
              _view.dom
                .querySelector(`[data-id="${CSS.escape(target.id)}"]`)
                ?.scrollIntoView({ block: 'center' })
              return true
            }
            return false
          },
        },
        view: () => {
          let timer: ReturnType<typeof setTimeout> | null = null
          return {
            update: (view) => {
              if (!researchKey.getState(view.state)?.stale) return
              if (timer) clearTimeout(timer)
              timer = setTimeout(() => {
                timer = null
                if (!view.isDestroyed) refreshResearch(view)
              }, REFRESH_DELAY_MS)
            },
            destroy: () => {
              if (timer) clearTimeout(timer)
            },
          }
        },
      }),
    ]
  },
})

export const isNumericStyle = (style: StyleId) =>
  STYLES.find((entry) => entry.id === style)?.kind === 'numeric'
