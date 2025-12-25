// Schema
export { schema, getDefaultDoc, createNodeId, nodeTypes, markTypes } from './schema'

// Types
export * from './types'

// Plugins
export {
  createEditorPlugins,
  createHistoryPlugins,
  createEditorKeymaps,
  createInputRules,
  createPlaceholderPlugin,
  createNodeIdPlugin,
  createCursorPlugins,
  createDragHandlePlugin,
  dragHandlePluginKey,
  getDragHandleState,
  dragHandleStyles,
  undo,
  redo,
  placeholderStyles,
} from './plugins'
export type { DragHandleState } from './plugins'

// Hooks
export {
  useEditor,
  useEditorState,
  useMarkActive,
  useNodeActive,
  useSelectionPosition,
  useSelectionRect,
} from './hooks'

// Components
export {
  Editor,
  EditorContent,
  BubbleMenu,
  bubbleMenuStyles,
  DragHandle,
  dragHandleComponentStyles,
  SlashMenu,
  useSlashMenuState,
} from './components'
export type {
  EditorProps,
  EditorHandle,
  EditorContentProps,
  EditorContentHandle,
  BubbleMenuProps,
  DragHandleProps,
} from './components'

// Context
export { EditorContext, useEditorContext, useEditorView } from './context/EditorContext'
export type { EditorContextValue } from './context/EditorContext'

// Commands
export * from './commands'

// Node Views
export {
  createNodeViews,
  createReactNodeView,
  nodeViewStyles,
  injectNodeViewStyles,
  CodeBlockView,
  ImageView,
  CalloutView,
  ToggleView,
  TaskItemView,
  codeBlockStyles,
  imageStyles,
  calloutStyles,
  toggleStyles,
  taskItemStyles,
} from './nodeViews'
export type { ReactNodeViewProps, ReactNodeViewOptions, NodeViewFactory } from './nodeViews'

// Serialization
export {
  toMarkdown,
  prosemirrorToMarkdown,
  fromMarkdown,
  markdownToProsemirror,
  migrateFromSlate,
  slateToProsemir,
} from './serialization'

// SlashMenu
export {
  createSlashMenuPlugin,
  slashMenuPluginKey,
  closeSlashMenu,
  getSlashMenuState,
  deleteSlashTrigger,
} from './plugins/slashMenu'
export type { SlashMenuState } from './plugins/slashMenu'

// Re-export useful ProseMirror types
export type { EditorState, Transaction, Plugin, PluginKey } from 'prosemirror-state'
export type { EditorView } from 'prosemirror-view'
export type { Node as ProseMirrorNode, Schema, Mark, MarkType, NodeType } from 'prosemirror-model'
