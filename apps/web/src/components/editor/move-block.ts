import { Extension } from '@tiptap/core'
import type { ResolvedPos } from '@tiptap/pm/model'
import { type EditorState, NodeSelection, TextSelection, type Transaction } from '@tiptap/pm/state'

const LIST_ITEMS = new Set(['listItem', 'taskItem'])

/**
 * The block the selection is in, as the thing to move: the innermost list
 * item if there is one, otherwise the top-level block (a whole table, quote
 * or callout moves as one).
 */
function movableDepth($pos: ResolvedPos): number {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (LIST_ITEMS.has($pos.node(depth).type.name)) return depth
  }
  return 1
}

/** Swap the selected block(s) with the sibling above (-1) or below (+1). */
export function moveBlock(state: EditorState, direction: -1 | 1): Transaction | null {
  const { $from, $to } = state.selection
  const depth = movableDepth($from)
  // A selection spanning several siblings moves them together.
  if ($to.depth < depth || $to.node(depth - 1) !== $from.node(depth - 1)) return null
  const parent = $from.node(depth - 1)
  const first = $from.index(depth - 1)
  const last = $to.index(depth - 1)
  const target = direction < 0 ? first - 1 : last + 1
  if (target < 0 || target >= parent.childCount) return null
  const other = parent.child(target)
  // Footnotes stay last, in reference order.
  if (other.type.name === 'footnotes' || parent.child(first).type.name === 'footnotes') return null

  const start = $from.before(depth)
  const end = $to.after(depth)
  const slice = state.doc.slice(start, end)
  const tr = state.tr
  let offset: number
  if (direction < 0) {
    tr.delete(start, end)
    tr.insert(start - other.nodeSize, slice.content)
    offset = -other.nodeSize
  } else {
    tr.insert(end + other.nodeSize, slice.content)
    tr.delete(start, end)
    offset = other.nodeSize
  }
  const { selection } = state
  tr.setSelection(
    selection instanceof NodeSelection
      ? NodeSelection.create(tr.doc, selection.from + offset)
      : TextSelection.create(tr.doc, selection.anchor + offset, selection.head + offset)
  )
  return tr.scrollIntoView()
}

/**
 * ⌘⇧↑ / ⌘⇧↓ (Ctrl+Shift on Windows and Linux) move the current block, the
 * keyboard counterpart of dragging it by its handle.
 */
export const MoveBlock = Extension.create({
  name: 'moveBlock',
  addKeyboardShortcuts() {
    const run = (direction: -1 | 1) => () => {
      const tr = moveBlock(this.editor.state, direction)
      if (tr) this.editor.view.dispatch(tr)
      // Consume the key even at the edges, so it never extends the selection
      // to the document's start or end instead.
      return true
    }
    return {
      'Mod-Shift-ArrowUp': run(-1),
      'Mod-Shift-ArrowDown': run(1),
    }
  },
})
