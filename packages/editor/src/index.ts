// Types
export * from './types'

// Extensions
export { createExtensions, Callout, Toggle, ImageBlock, NoteLink } from './extensions'
export type {
  ExtensionOptions,
  CalloutOptions,
  ToggleOptions,
  ImageBlockOptions,
  NoteLinkOptions,
} from './extensions'

// Components
export {
  Editor,
  BubbleMenu,
  SlashMenuExtension,
  SlashMenuList,
  slashMenuItems,
  filterSlashMenuItems,
  CalloutView,
  CodeBlockView,
  ToggleView,
  ImageBlockView,
} from './components'
export type {
  EditorProps,
  EditorHandle,
  BubbleMenuProps,
  SlashMenuItem,
  SlashMenuRef,
  SlashMenuListProps,
} from './components'

// Utilities
export {
  migrateContent,
  migrateFromSlate,
  migrateFromProseMirror,
  isSlateContent,
  isProseMirrorContent,
  isTiptapContent,
  needsMigration,
  toMarkdown,
  fromMarkdown,
  toPlainText,
  countWords,
  countCharacters,
} from './lib'

// Styles (import in your app)
// import '@lemma/editor/styles/editor.css'
