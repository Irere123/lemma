import type { Node as ProseMirrorNode, ResolvedPos } from "prosemirror-model";
import { EditorState, Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";

export const dragHandlePluginKey = new PluginKey<DragHandleState>("dragHandle");

export interface DragHandleState {
  activeBlockPos: number | null;
  activeBlockNode: ProseMirrorNode | null;
  activeBlockDom: HTMLElement | null;
  isDragging: boolean;
  dropPos: number | null;
}

interface DragHandleOptions {
  onDragStart?: (view: EditorView, pos: number, node: ProseMirrorNode) => void;
  onDragEnd?: (view: EditorView) => void;
  onDrop?: (view: EditorView, from: number, to: number, node: ProseMirrorNode) => void;
}

/**
 * Creates a drag handle plugin for block-level drag and drop
 */
export function createDragHandlePlugin(options: DragHandleOptions = {}): Plugin {
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
        };
      },

      apply(tr, value): DragHandleState {
        const meta = tr.getMeta(dragHandlePluginKey);
        if (meta) {
          return { ...value, ...meta };
        }
        return value;
      },
    },

    props: {
      handleDOMEvents: {
        mousemove(view, event) {
          const pos = getBlockPosFromCoords(view, event.clientX, event.clientY);

          if (pos !== null) {
            const node = view.state.doc.nodeAt(pos);
            if (node && isBlockNode(node)) {
              const dom = view.nodeDOM(pos) as HTMLElement | null;
              updateDragHandleState(view, pos, node, dom);
            } else {
              clearDragHandleState(view);
            }
          } else {
            clearDragHandleState(view);
          }

          return false;
        },

        mouseleave(view, _event) {
          const state = dragHandlePluginKey.getState(view.state);
          if (state && !state.isDragging) {
            clearDragHandleState(view);
          }
          return false;
        },

        drop(view, event) {
          const state = dragHandlePluginKey.getState(view.state);
          if (state?.isDragging && state.activeBlockPos !== null && state.dropPos !== null) {
            event.preventDefault();

            const from = state.activeBlockPos;
            const to = state.dropPos;
            const node = state.activeBlockNode;

            if (node && from !== to) {
              // Move the block
              const { tr } = view.state;
              const nodeSize = node.nodeSize;

              // Delete from original position
              tr.delete(from, from + nodeSize);

              // Calculate new position after deletion
              const adjustedTo = to > from ? to - nodeSize : to;

              // Insert at new position
              tr.insert(adjustedTo, node);

              view.dispatch(tr);

              if (options.onDrop) {
                options.onDrop(view, from, adjustedTo, node);
              }
            }

            clearDragHandleState(view);
            if (options.onDragEnd) {
              options.onDragEnd(view);
            }

            return true;
          }
          return false;
        },

        dragend(view, _event) {
          const state = dragHandlePluginKey.getState(view.state);
          if (state?.isDragging) {
            clearDragHandleState(view);
            if (options.onDragEnd) {
              options.onDragEnd(view);
            }
          }
          return false;
        },
      },

      decorations(state) {
        const pluginState = dragHandlePluginKey.getState(state);
        if (!pluginState) return DecorationSet.empty;

        const decorations: Decoration[] = [];

        // Add active block highlight
        if (pluginState.activeBlockPos !== null && pluginState.activeBlockNode) {
          decorations.push(
            Decoration.node(
              pluginState.activeBlockPos,
              pluginState.activeBlockPos + pluginState.activeBlockNode.nodeSize,
              { class: "drag-handle-active" }
            )
          );
        }

        // Add drop indicator
        if (pluginState.isDragging && pluginState.dropPos !== null) {
          decorations.push(
            Decoration.widget(pluginState.dropPos, () => {
              const indicator = document.createElement("div");
              indicator.className = "drag-drop-indicator";
              return indicator;
            })
          );
        }

        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

function getBlockPosFromCoords(view: EditorView, x: number, y: number): number | null {
  const pos = view.posAtCoords({ left: x, top: y });
  if (!pos) return null;

  const $pos = view.state.doc.resolve(pos.pos);
  return getBlockPos($pos);
}

function getBlockPos($pos: ResolvedPos): number | null {
  // Walk up to find a block-level node
  for (let depth = $pos.depth; depth >= 1; depth--) {
    const node = $pos.node(depth);
    if (isBlockNode(node)) {
      return $pos.before(depth);
    }
  }
  return null;
}

function isBlockNode(node: ProseMirrorNode): boolean {
  return node.isBlock && !node.isTextblock === false && node.type.name !== "doc";
}

function updateDragHandleState(
  view: EditorView,
  pos: number,
  node: ProseMirrorNode,
  dom: HTMLElement | null
): void {
  const currentState = dragHandlePluginKey.getState(view.state);
  if (currentState?.activeBlockPos === pos) return;

  const { tr } = view.state;
  tr.setMeta(dragHandlePluginKey, {
    activeBlockPos: pos,
    activeBlockNode: node,
    activeBlockDom: dom,
  });
  view.dispatch(tr);
}

function clearDragHandleState(view: EditorView): void {
  const currentState = dragHandlePluginKey.getState(view.state);
  if (!currentState?.activeBlockPos && !currentState?.isDragging) return;

  const { tr } = view.state;
  tr.setMeta(dragHandlePluginKey, {
    activeBlockPos: null,
    activeBlockNode: null,
    activeBlockDom: null,
    isDragging: false,
    dropPos: null,
  });
  view.dispatch(tr);
}

/**
 * Start dragging a block
 */
export function startDrag(view: EditorView): void {
  const state = dragHandlePluginKey.getState(view.state);
  if (state?.activeBlockPos !== null) {
    const { tr } = view.state;
    tr.setMeta(dragHandlePluginKey, { isDragging: true });
    view.dispatch(tr);
  }
}

/**
 * Update drop position during drag
 */
export function updateDropPosition(view: EditorView, y: number): void {
  const state = dragHandlePluginKey.getState(view.state);
  if (!state?.isDragging) return;

  const pos = view.posAtCoords({ left: 0, top: y });
  if (!pos) return;

  const $pos = view.state.doc.resolve(pos.pos);
  let dropPos: number | null = null;

  // Find the nearest block boundary
  for (let depth = $pos.depth; depth >= 1; depth--) {
    const node = $pos.node(depth);
    if (isBlockNode(node)) {
      const before = $pos.before(depth);
      const after = $pos.after(depth);
      const nodeTop = view.coordsAtPos(before).top;
      const nodeBottom = view.coordsAtPos(after).bottom;
      const middle = (nodeTop + nodeBottom) / 2;

      dropPos = y < middle ? before : after;
      break;
    }
  }

  if (dropPos !== state.dropPos) {
    const { tr } = view.state;
    tr.setMeta(dragHandlePluginKey, { dropPos });
    view.dispatch(tr);
  }
}

/**
 * Get current drag handle state
 */
export function getDragHandleState(state: EditorState): DragHandleState | undefined {
  return dragHandlePluginKey.getState(state);
}

// Styles for drag handle
export const dragHandleStyles = `
.drag-handle-active {
  position: relative;
}

.drag-handle-active::before {
  content: "";
  position: absolute;
  left: -24px;
  top: 0;
  width: 4px;
  height: 100%;
  background-color: #3b82f6;
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.drag-handle-active:hover::before {
  opacity: 1;
}

.drag-drop-indicator {
  position: relative;
  height: 2px;
  margin: -1px 0;
  background-color: #3b82f6;
  border-radius: 1px;
  pointer-events: none;
}

.drag-drop-indicator::before,
.drag-drop-indicator::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  background-color: #3b82f6;
  border-radius: 50%;
  transform: translateY(-50%);
}

.drag-drop-indicator::before {
  left: 0;
}

.drag-drop-indicator::after {
  right: 0;
}

/* Drag handle button container */
.drag-handle-container {
  position: absolute;
  left: -32px;
  top: 0;
  display: flex;
  align-items: center;
  height: 100%;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}

*:hover > .drag-handle-container,
.drag-handle-container:hover {
  opacity: 1;
  pointer-events: auto;
}

.drag-handle-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  color: #9ca3af;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: grab;
  transition: all 0.15s;
}

.drag-handle-button:hover {
  color: #374151;
  background-color: #f3f4f6;
}

.drag-handle-button:active {
  cursor: grabbing;
}

.drag-handle-button svg {
  width: 14px;
  height: 14px;
}
`;
