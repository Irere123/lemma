import { mergeAttributes, Node } from '@tiptap/core'
import { Fragment, type Node as PMNode, type Schema, Slice } from '@tiptap/pm/model'
import {
  type EditorState,
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { ySyncPluginKey } from '@tiptap/y-tiptap'

// Footnotes: an inline `footnoteReference` marks the call site; the note bodies
// live in one `footnotes` list that the document schema only allows at the very
// end (`block+ footnotes?`). The list is kept in reference order by a plugin, so
// numbering is just "position in the list" and never stored.

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnotes: {
      insertFootnote: () => ReturnType
    }
  }
}

export const newFootnoteId = () => `fn-${Math.random().toString(36).slice(2, 10)}`

const idAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) =>
    element.getAttribute('data-id') ?? element.getAttribute('data-footnote-id'),
  renderHTML: (attributes: Record<string, unknown>) =>
    attributes.id ? { 'data-id': attributes.id as string } : {},
}

export const FootnoteReference = Node.create({
  name: 'footnoteReference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return { id: idAttribute }
  },

  parseHTML() {
    return [{ tag: 'sup[data-footnote-ref]', priority: 1000 }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(HTMLAttributes, { class: 'footnote-ref', 'data-footnote-ref': '' }),
    ]
  },

  renderText() {
    return ''
  },

  addCommands() {
    return {
      insertFootnote:
        () =>
        ({ state, tr, dispatch }) => {
          const { schema } = state
          const ref = schema.nodes.footnoteReference?.create({ id: newFootnoteId() })
          if (!ref || !schema.nodes.footnotes) return false
          if (!dispatch) return true

          tr.replaceSelectionWith(ref, false)
          syncFootnotes(tr, schema)

          // Put the caret inside the new note so the writer can type it straight away.
          const id = ref.attrs.id as string
          tr.doc.descendants((node, pos) => {
            if (node.type.name === 'footnote' && node.attrs.id === id) {
              tr.setSelection(TextSelection.create(tr.doc, pos + 2))
              return false
            }
            return node.type.name === 'doc' || node.type.name === 'footnotes'
          })
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Same shortcut as Google Docs and Word (Windows).
      'Mod-Alt-f': () => this.editor.commands.insertFootnote(),
    }
  },
})

export const Footnotes = Node.create({
  name: 'footnotes',
  content: 'footnote+',
  isolating: true,
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'ol[data-footnotes]', priority: 1000 }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['ol', mergeAttributes(HTMLAttributes, { class: 'footnotes', 'data-footnotes': '' }), 0]
  },

  addProseMirrorPlugins() {
    return [footnotesPlugin(this.editor.schema)]
  },
})

export const Footnote = Node.create({
  name: 'footnote',
  content: 'paragraph+',
  isolating: true,
  defining: true,

  addAttributes() {
    return { id: idAttribute }
  },

  parseHTML() {
    return [
      { tag: 'li[data-footnote-id]', priority: 1000 },
      // The published "↩" back-link is navigation, not part of the note.
      { tag: 'a[data-footnote-backref]', priority: 1000, ignore: true },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['li', mergeAttributes(HTMLAttributes, { class: 'footnote' }), 0]
  },
})

// Note bodies that arrived in a paste, waiting for their reference to land.
const pendingNotes = new Map<string, Fragment>()

function referenceIds(doc: PMNode): string[] {
  const ids: string[] = []
  doc.forEach((block) => {
    if (block.type.name === 'footnotes') return
    block.descendants((node) => {
      if (node.type.name === 'footnoteReference' && typeof node.attrs.id === 'string') {
        ids.push(node.attrs.id)
      }
      return true
    })
  })
  return ids
}

function findFootnotes(doc: PMNode): { node: PMNode; pos: number } | null {
  const last = doc.lastChild
  if (last?.type.name !== 'footnotes') return null
  return { node: last, pos: doc.content.size - last.nodeSize }
}

/** Make the trailing footnotes list match the references, in order. Mutates `tr`. */
export function syncFootnotes(tr: Transaction, schema: Schema): boolean {
  const footnoteType = schema.nodes.footnote
  const footnotesType = schema.nodes.footnotes
  const paragraphType = schema.nodes.paragraph
  if (!footnoteType || !footnotesType || !paragraphType) return false

  const ids = [...new Set(referenceIds(tr.doc))]
  const list = findFootnotes(tr.doc)

  const existing = new Map<string, PMNode>()
  list?.node.forEach((note) => {
    if (typeof note.attrs.id === 'string') existing.set(note.attrs.id, note)
  })

  const current = list ? list.node.content.content.map((note) => note.attrs.id) : []
  if (current.length === ids.length && current.every((id, index) => id === ids[index])) {
    return false
  }

  const notes = ids.map((id) => {
    const kept = existing.get(id)
    if (kept) return kept
    const pasted = pendingNotes.get(id)
    pendingNotes.delete(id)
    return footnoteType.create({ id }, pasted ?? paragraphType.create())
  })

  if (notes.length === 0) {
    if (list) tr.delete(list.pos, list.pos + list.node.nodeSize)
  } else if (list) {
    tr.replaceWith(list.pos, list.pos + list.node.nodeSize, footnotesType.create(null, notes))
  } else {
    tr.insert(tr.doc.content.size, footnotesType.create(null, notes))
  }
  return true
}

function touchesFootnotes(tr: Transaction): boolean {
  let touched = false
  for (const step of tr.steps) {
    const json = step.toJSON() as { slice?: { content?: unknown[] } }
    if (json.slice && JSON.stringify(json.slice).includes('"footnote')) touched = true
    if (touched) break
  }
  if (touched) return true
  // Deletions: look at what the step removed.
  tr.mapping.maps.forEach((map, index) => {
    if (touched) return
    const before = tr.docs[index]
    if (!before) return
    map.forEach((from, to) => {
      if (touched || from === to) return
      before.nodesBetween(from, Math.min(to, before.content.size), (node) => {
        if (node.type.name.startsWith('footnote')) touched = true
        return !touched
      })
    })
  })
  return touched
}

const footnotesKey = new PluginKey<DecorationSet>('footnotes')

function numberDecorations(doc: PMNode): DecorationSet {
  const order = new Map<string, number>()
  for (const id of referenceIds(doc)) if (!order.has(id)) order.set(id, order.size + 1)
  if (order.size === 0) return DecorationSet.empty

  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name === 'footnoteReference') {
      const number = order.get(node.attrs.id as string)
      if (number) {
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, { 'data-number': String(number) })
        )
      }
    }
    return true
  })
  return DecorationSet.create(doc, decorations)
}

function footnotesPlugin(schema: Schema) {
  return new Plugin<DecorationSet>({
    key: footnotesKey,
    state: {
      init: (_, state) => numberDecorations(state.doc),
      apply: (tr, decorations, _old, state: EditorState) =>
        tr.docChanged
          ? touchesFootnotes(tr)
            ? numberDecorations(state.doc)
            : decorations.map(tr.mapping, tr.doc)
          : decorations,
    },
    props: {
      decorations: (state) => footnotesKey.getState(state),
      // Pasted note bodies can't sit mid-document (the list only lives at the end),
      // so park them until syncFootnotes places them under their reference.
      transformPasted: (slice, view) => {
        const taken = new Set(referenceIds(view.state.doc))
        const renamed = new Map<string, string>()
        const strip = (fragment: Fragment): Fragment => {
          const children: PMNode[] = []
          fragment.forEach((node) => {
            if (node.type.name === 'footnotes') {
              node.forEach((note) => {
                const id = note.attrs.id as string
                pendingNotes.set(renamed.get(id) ?? id, note.content)
              })
              return
            }
            if (node.type.name === 'footnoteReference') {
              const id = node.attrs.id as string
              // Every reference to the same pasted note keeps pointing at it.
              let next = renamed.get(id)
              if (next === undefined) {
                next = taken.has(id) ? newFootnoteId() : id
                renamed.set(id, next)
                taken.add(next)
              }
              children.push(node.type.create({ id: next }))
              return
            }
            children.push(node.copy(strip(node.content)))
          })
          return Fragment.fromArray(children)
        }
        // Rename refs first (depth-first order puts refs before the list), then strip.
        const content = strip(slice.content)
        for (const [from, to] of renamed) {
          if (from !== to && pendingNotes.has(from)) {
            const body = pendingNotes.get(from)
            pendingNotes.delete(from)
            if (body) pendingNotes.set(to, body)
          }
        }
        return new Slice(content, slice.openStart, slice.openEnd)
      },
    },
    appendTransaction(transactions, _oldState, newState) {
      const local = transactions.filter(
        (tr) => tr.docChanged && !tr.getMeta(ySyncPluginKey)?.isChangeOrigin
      )
      if (local.length === 0 || !local.some(touchesFootnotes)) return null
      const tr = newState.tr
      return syncFootnotes(tr, schema) ? tr : null
    },
  })
}
