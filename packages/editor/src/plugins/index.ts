import type { Plugin } from 'prosemirror-state'
import type { Schema } from 'prosemirror-model'
import { schema as defaultSchema } from '../schema'
import { createHistoryPlugins } from './history'
import { createEditorKeymaps } from './keymap'
import { createInputRules } from './inputRules'
import { createPlaceholderPlugin } from './placeholder'
import { createNodeIdPlugin } from './nodeId'
import { createCursorPlugins } from './dropCursor'
import { createSlashMenuPlugin, type SlashMenuState } from './slashMenu'
import { createDragHandlePlugin } from './dragHandle'

export interface EditorPluginOptions {
  placeholder?: string
  schema?: Schema
  onSlashMenuChange?: (state: SlashMenuState) => void
  enableDragHandle?: boolean
}

/**
 * Creates all editor plugins in the correct order
 */
export function createEditorPlugins(options: EditorPluginOptions = {}): Plugin[] {
  const {
    placeholder = 'Start writing...',
    schema = defaultSchema,
    onSlashMenuChange,
    enableDragHandle = true,
  } = options

  const plugins: Plugin[] = [
    // Input processing (should come first)
    createInputRules(schema),

    // Keymaps (order matters - more specific first)
    ...createEditorKeymaps(schema),

    // History (undo/redo)
    ...createHistoryPlugins(),

    // Cursors
    ...createCursorPlugins(),

    // Placeholder
    createPlaceholderPlugin({ placeholder }),

    // Slash menu
    createSlashMenuPlugin({ onStateChange: onSlashMenuChange }),

    // Node ID management
    createNodeIdPlugin(),
  ]

  // Drag handle (optional, enabled by default)
  if (enableDragHandle) {
    plugins.push(createDragHandlePlugin())
  }

  return plugins
}

// Re-export individual plugins
export { createHistoryPlugins, undo, redo } from './history'
export { createEditorKeymaps, createFormattingKeymap, createListKeymap } from './keymap'
export { createInputRules } from './inputRules'
export { createPlaceholderPlugin, placeholderPluginKey, placeholderStyles } from './placeholder'
export { createNodeIdPlugin, nodeIdPluginKey, getNodeById, getAllNodeIds } from './nodeId'
export { createDropCursorPlugin, createGapCursorPlugin, createCursorPlugins } from './dropCursor'
export {
  createSlashMenuPlugin,
  slashMenuPluginKey,
  closeSlashMenu,
  getSlashMenuState,
  deleteSlashTrigger,
  type SlashMenuState,
} from './slashMenu'
export {
  createDragHandlePlugin,
  dragHandlePluginKey,
  startDrag,
  updateDropPosition,
  endDrag,
  insertBlockAfter,
  getDragHandleState,
  dragHandleStyles,
  type DragHandleState,
} from './dragHandle'
