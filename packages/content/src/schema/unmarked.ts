import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { AddMarkStep, AddNodeMarkStep, Mapping } from '@tiptap/pm/transform'

/**
 * Inline nodes that never carry marks (bold, colour, links…). The Yjs layer
 * stores marks on text only, so a mark on one of these would vanish on the
 * next sync; the model says so up front instead. Colour an equation in TeX
 * (`\color{…}`) if needed.
 */
export const UNMARKED_INLINE_TYPES: ReadonlySet<string> = new Set([
  'hardBreak',
  'inlineMath',
  'footnoteReference',
])

/** Strips marks from those nodes as they are applied (bold across a sentence, paste…). */
export const UnmarkedInlineNodes = Extension.create({
  name: 'unmarkedInlineNodes',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('unmarkedInlineNodes'),
        appendTransaction(transactions, _oldState, state) {
          if (
            !transactions.some((tr) => tr.docChanged) ||
            transactions.some((tr) => tr.getMeta('y-sync$'))
          ) {
            return null
          }
          // Where these transactions changed something, in final positions:
          // each step's range, mapped through every step after it. Mark steps
          // don't move content, so their own from/to is the range.
          const steps = transactions.flatMap((tr) => tr.steps)
          const mapping = new Mapping()
          for (const tr of transactions) for (const map of tr.mapping.maps) mapping.appendMap(map)
          let from = Number.POSITIVE_INFINITY
          let to = -1
          steps.forEach((step, index) => {
            const after = mapping.slice(index + 1)
            const extend = (start: number, end: number) => {
              from = Math.min(from, after.map(start, -1))
              to = Math.max(to, after.map(end, 1))
            }
            if (step instanceof AddMarkStep || step instanceof AddNodeMarkStep) {
              const json = step.toJSON() as { from?: number; to?: number; pos?: number }
              const start = json.from ?? json.pos ?? 0
              extend(start, json.to ?? start + 1)
            } else {
              step.getMap().forEach((_oldStart, _oldEnd, newStart, newEnd) => {
                extend(newStart, newEnd)
              })
            }
          })
          if (to < 0) return null
          from = Math.max(0, from)
          to = Math.min(state.doc.content.size, to)
          const marked: { pos: number; node: PMNode }[] = []
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (UNMARKED_INLINE_TYPES.has(node.type.name) && node.marks.length > 0) {
              marked.push({ pos, node })
            }
          })
          if (marked.length === 0) return null
          const tr = state.tr
          for (const { pos, node } of marked) tr.setNodeMarkup(pos, undefined, node.attrs, [])
          // Not marked addToHistory: false. With Yjs that flag is decided by
          // the last transaction of the batch, so it would make the writer's
          // own edit (the bold, the paste) impossible to undo.
          return tr
        },
      }),
    ]
  },
})
