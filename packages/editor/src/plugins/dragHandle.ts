import type { Node as ProseMirrorNode, ResolvedPos } from 'prosemirror-model'
import { EditorState, Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'

export const dragHandlePluginKey = new PluginKey<DragHandleState>('dragHandle')

export interface DragHandleState {
  activeBlockPos: number | null
  activeBlockNode: ProseMirrorNode | null
  activeBlockDom: HTMLElement | null
  isDragging: boolean
  dropPos: number | null
}

interface DragHandleOptions {
  onDragStart?: (view: EditorView, pos: number, node: ProseMirrorNode) => void
  onDragEnd?: (view: EditorView) => void
  onDrop?: (view: EditorView, from: number, to: number, node: ProseMirrorNode) => void
}

/**
 * Creates a drag handle plugin for block-level drag and drop
 */
export function createDragHandlePlugin(options: DragHandleOptions = {}): Plugin {
  let hideTimeout: ReturnType<typeof setTimeout> | null = null

  return new Plugin<DragHandleState>({
    key: dragHandlePluginKey,

    state: {
      init(): DragHandleState {
        return {
          activeBlockPos: null,
          activeBlockNode: null,
          activeBlockDom: null,
          isDragging: false,
          dropPos: null,
        }
      },

      apply(tr, value): DragHandleState {
        const meta = tr.getMeta(dragHandlePluginKey)
        if (meta) {
          return { ...value, ...meta }
        }

        // If the document changed, try to keep the active block if it's still valid
        if (tr.docChanged && value.activeBlockPos !== null) {
          const mapped = tr.mapping.mapResult(value.activeBlockPos)
          if (!mapped.deleted) {
            const node = tr.doc.nodeAt(mapped.pos)
            if (node && isBlockNode(node)) {
              return {
                ...value,
                activeBlockPos: mapped.pos,
                activeBlockNode: node,
              }
            }
          }
          // Block was deleted or invalid, clear state
          return {
            activeBlockPos: null,
            activeBlockNode: null,
            activeBlockDom: null,
            isDragging: false,
            dropPos: null,
          }
        }

        return value
      },
    },

    props: {
      handleDOMEvents: {
        mousemove(view, event) {
          // Clear any pending hide timeout
          if (hideTimeout) {
            clearTimeout(hideTimeout)
            hideTimeout = null
          }

          // Don't update during drag
          const state = dragHandlePluginKey.getState(view.state)
          if (state?.isDragging) return false

          const target = event.target as HTMLElement
          const editorRect = view.dom.getBoundingClientRect()

          // Check if mouse is in the left margin area (where drag handle would be)
          const isInLeftMargin = event.clientX < editorRect.left + 60

          // Get the block at the current mouse position
          const pos = getBlockPosFromCoords(view, event.clientX, event.clientY)

          if (pos !== null) {
            const node = view.state.doc.nodeAt(pos)
            if (node && isBlockNode(node)) {
              const dom = view.nodeDOM(pos) as HTMLElement | null
              updateDragHandleState(view, pos, node, dom)
            } else {
              // If not in left margin, schedule a hide
              if (!isInLeftMargin) {
                scheduleHide(view)
              }
            }
          } else if (!isInLeftMargin) {
            scheduleHide(view)
          }

          return false
        },

        mouseleave(view, event) {
          const state = dragHandlePluginKey.getState(view.state)
          if (state && !state.isDragging) {
            // Delay clearing to allow moving to the drag handle
            scheduleHide(view)
          }
          return false
        },

        drop(view, event) {
          const state = dragHandlePluginKey.getState(view.state)
          if (state?.isDragging && state.activeBlockPos !== null && state.dropPos !== null) {
            event.preventDefault()

            const from = state.activeBlockPos
            const to = state.dropPos
            const node = state.activeBlockNode

            if (node && from !== to) {
              // Move the block
              const { tr } = view.state
              const nodeSize = node.nodeSize

              // Delete from original position
              tr.delete(from, from + nodeSize)

              // Calculate new position after deletion
              const adjustedTo = to > from ? to - nodeSize : to

              // Insert at new position
              tr.insert(adjustedTo, node)

              view.dispatch(tr)

              if (options.onDrop) {
                options.onDrop(view, from, adjustedTo, node)
              }
            }

            clearDragHandleState(view)
            if (options.onDragEnd) {
              options.onDragEnd(view)
            }

            return true
          }
          return false
        },

        dragend(view, _event) {
          const state = dragHandlePluginKey.getState(view.state)
          if (state?.isDragging) {
            clearDragHandleState(view)
            if (options.onDragEnd) {
              options.onDragEnd(view)
            }
          }
          return false
        },
      },

      decorations(state) {
        const pluginState = dragHandlePluginKey.getState(state)
        if (!pluginState) return DecorationSet.empty

        const decorations: Decoration[] = []

        // Add drop indicator during drag
        if (pluginState.isDragging && pluginState.dropPos !== null) {
          decorations.push(
            Decoration.widget(pluginState.dropPos, () => {
              const indicator = document.createElement('div')
              indicator.className = 'pm-drag-drop-indicator'
              return indicator
            })
          )
        }

        return DecorationSet.create(state.doc, decorations)
      },
    },

    view() {
      return {
        destroy() {
          if (hideTimeout) {
            clearTimeout(hideTimeout)
          }
        },
      }
    },
  })

  function scheduleHide(view: EditorView) {
    if (hideTimeout) {
      clearTimeout(hideTimeout)
    }
    hideTimeout = setTimeout(() => {
      const state = dragHandlePluginKey.getState(view.state)
      if (state && !state.isDragging) {
        clearDragHandleState(view)
      }
      hideTimeout = null
    }, 150)
  }
}

function getBlockPosFromCoords(view: EditorView, x: number, y: number): number | null {
  // Use the editor's content area for position calculation
  const editorRect = view.dom.getBoundingClientRect()
  const adjustedX = Math.max(editorRect.left + 10, x)

  const pos = view.posAtCoords({ left: adjustedX, top: y })
  if (!pos) return null

  const $pos = view.state.doc.resolve(pos.pos)
  return getBlockPos($pos)
}

function getBlockPos($pos: ResolvedPos): number | null {
  // Walk up to find a top-level block node (direct child of doc)
  for (let depth = $pos.depth; depth >= 1; depth--) {
    const node = $pos.node(depth)
    // We want the first block-level node that's a direct child of the doc
    // or any block that isn't a list item (to handle nested lists properly)
    if (isBlockNode(node) && depth === 1) {
      return $pos.before(depth)
    }
    // For deeper nodes, find the top-level parent
    if (isBlockNode(node) && $pos.node(depth - 1)?.type.name === 'doc') {
      return $pos.before(depth)
    }
  }

  // If we're at depth 1, return that position
  if ($pos.depth >= 1) {
    const node = $pos.node(1)
    if (isBlockNode(node)) {
      return $pos.before(1)
    }
  }

  return null
}

function isBlockNode(node: ProseMirrorNode): boolean {
  // A block node is any block-level node that isn't the doc itself
  return node.isBlock && node.type.name !== 'doc'
}

function updateDragHandleState(
  view: EditorView,
  pos: number,
  node: ProseMirrorNode,
  dom: HTMLElement | null
): void {
  const currentState = dragHandlePluginKey.getState(view.state)
  if (currentState?.activeBlockPos === pos) return

  const { tr } = view.state
  tr.setMeta(dragHandlePluginKey, {
    activeBlockPos: pos,
    activeBlockNode: node,
    activeBlockDom: dom,
  })
  view.dispatch(tr)
}

function clearDragHandleState(view: EditorView): void {
  const currentState = dragHandlePluginKey.getState(view.state)
  if (!currentState?.activeBlockPos && !currentState?.isDragging) return

  const { tr } = view.state
  tr.setMeta(dragHandlePluginKey, {
    activeBlockPos: null,
    activeBlockNode: null,
    activeBlockDom: null,
    isDragging: false,
    dropPos: null,
  })
  view.dispatch(tr)
}

/**
 * Start dragging a block
 */
export function startDrag(view: EditorView): void {
  const state = dragHandlePluginKey.getState(view.state)
  if (state?.activeBlockPos !== null) {
    const { tr } = view.state
    tr.setMeta(dragHandlePluginKey, { isDragging: true })
    view.dispatch(tr)
  }
}

/**
 * Update drop position during drag
 */
export function updateDropPosition(view: EditorView, y: number): void {
  const state = dragHandlePluginKey.getState(view.state)
  if (!state?.isDragging) return

  const editorRect = view.dom.getBoundingClientRect()
  const pos = view.posAtCoords({ left: editorRect.left + 50, top: y })
  if (!pos) return

  const $pos = view.state.doc.resolve(pos.pos)
  let dropPos: number | null = null

  // Find the nearest block boundary
  for (let depth = Math.min($pos.depth, 1); depth >= 1; depth--) {
    const node = $pos.node(depth)
    if (isBlockNode(node)) {
      const before = $pos.before(depth)
      const after = $pos.after(depth)

      try {
        const coordsBefore = view.coordsAtPos(before)
        const coordsAfter = view.coordsAtPos(after)
        const middle = (coordsBefore.top + coordsAfter.bottom) / 2

        dropPos = y < middle ? before : after
      } catch {
        dropPos = before
      }
      break
    }
  }

  if (dropPos !== null && dropPos !== state.dropPos) {
    const { tr } = view.state
    tr.setMeta(dragHandlePluginKey, { dropPos })
    view.dispatch(tr)
  }
}

/**
 * End the drag operation
 */
export function endDrag(view: EditorView): void {
  clearDragHandleState(view)
}

/**
 * Get current drag handle state
 */
export function getDragHandleState(state: EditorState): DragHandleState | undefined {
  return dragHandlePluginKey.getState(state)
}

/**
 * Insert a new paragraph after a block
 */
export function insertBlockAfter(view: EditorView): void {
  const state = getDragHandleState(view.state)
  if (state?.activeBlockPos !== null && state?.activeBlockNode) {
    const pos = state.activeBlockPos + state.activeBlockNode.nodeSize
    const { tr } = view.state
    const paragraph = view.state.schema.nodes.paragraph.create()
    tr.insert(pos, paragraph)
    tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))
    view.dispatch(tr)
    view.focus()
  }
}

// Styles for drag handle
export const dragHandleStyles = `
/* Drop indicator line */
.pm-drag-drop-indicator {
  position: relative;
  height: 3px;
  margin: -1.5px 0;
  background: linear-gradient(90deg, #3b82f6 0%, #3b82f6 100%);
  border-radius: 2px;
  pointer-events: none;
  z-index: 100;
}

.pm-drag-drop-indicator::before,
.pm-drag-drop-indicator::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  background-color: #3b82f6;
  border-radius: 50%;
  transform: translateY(-50%);
}

.pm-drag-drop-indicator::before {
  left: -4px;
}

.pm-drag-drop-indicator::after {
  right: -4px;
}

/* Dragging state */
body.is-dragging-block {
  cursor: grabbing !important;
  user-select: none;
}

body.is-dragging-block * {
  cursor: grabbing !important;
}

body.is-dragging-block .ProseMirror {
  pointer-events: none;
}

body.is-dragging-block .pm-drag-handle {
  pointer-events: auto;
}

/* Active block highlight - subtle left border */
.ProseMirror .pm-block-active {
  position: relative;
}

.ProseMirror .pm-block-active::before {
  content: "";
  position: absolute;
  left: -20px;
  top: 0;
  bottom: 0;
  width: 3px;
  background-color: #3b82f6;
  border-radius: 2px;
  opacity: 0.5;
}
`
