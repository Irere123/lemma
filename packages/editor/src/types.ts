import type { Editor, JSONContent } from '@tiptap/core'

// Node type names
export const NodeType = {
  Doc: 'doc',
  Paragraph: 'paragraph',
  Heading: 'heading',
  BulletList: 'bulletList',
  OrderedList: 'orderedList',
  ListItem: 'listItem',
  TaskList: 'taskList',
  TaskItem: 'taskItem',
  Blockquote: 'blockquote',
  CodeBlock: 'codeBlock',
  Callout: 'callout',
  Toggle: 'toggle',
  Image: 'image',
  Divider: 'horizontalRule',
  HardBreak: 'hardBreak',
  Text: 'text',
} as const

export type NodeTypeName = (typeof NodeType)[keyof typeof NodeType]

// Mark type names
export const MarkType = {
  Bold: 'bold',
  Italic: 'italic',
  Code: 'code',
  Underline: 'underline',
  Strikethrough: 'strike',
  Highlight: 'highlight',
  Link: 'link',
  NoteLink: 'noteLink',
} as const

export type MarkTypeName = (typeof MarkType)[keyof typeof MarkType]

// Heading levels
export type HeadingLevel = 1 | 2 | 3

// Callout variants
export type CalloutVariant = 'info' | 'warning' | 'success' | 'error' | 'tip' | 'note'

// Node attributes
export interface HeadingAttrs {
  level: HeadingLevel
  id?: string
}

export interface TaskItemAttrs {
  checked: boolean
  id?: string
}

export interface CodeBlockAttrs {
  language: string | null
  id?: string
}

export interface CalloutAttrs {
  variant: CalloutVariant
  id?: string
}

export interface ToggleAttrs {
  open: boolean
  id?: string
}

export interface ImageAttrs {
  src: string
  alt?: string
  title?: string
  width?: number
  height?: number
  alignment?: 'left' | 'center' | 'right'
}

// Mark attributes
export interface LinkAttrs {
  href: string
  target?: string
  rel?: string
  class?: string
}

export interface NoteLinkAttrs {
  noteId: string
  noteTitle: string
}

// Image upload types
export interface ImageUploadResult {
  url: string
  filename: string
}

export type ImageUploadFn = (file: File) => Promise<ImageUploadResult>

// Toast function type
export type ShowToastFn = (message: string, type?: 'success' | 'error' | 'info') => void

// Document types for store integration
export interface EditorDocument {
  id: string
  title: string | null
  subtitle: string | null
  content?: JSONContent
}

// Store API interfaces
export interface EditorStoreApi {
  getActiveEditor: (documentId: string) => Editor | undefined
  addActiveEditor: (documentId: string) => void
  subscribe: (listener: () => void) => () => void
}

export interface DocumentStoreApi {
  getDocument: (documentId: string) => EditorDocument | undefined
  updateDocument: (update: Partial<EditorDocument> & { id: string }) => void
  subscribe: (listener: () => void) => () => void
}

// Editor props
export interface LemmaEditorProps {
  content?: JSONContent | string
  placeholder?: string
  editable?: boolean
  autofocus?: boolean | 'start' | 'end' | 'all' | number | null
  onUpdate?: (props: { editor: Editor; content: JSONContent; markdown: string }) => void
  onFocus?: (props: { editor: Editor }) => void
  onBlur?: (props: { editor: Editor }) => void
  onImageUpload?: ImageUploadFn
  className?: string
}

// Slash menu types
export interface SlashMenuItem {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  keywords: string[]
  command: (props: { editor: Editor; range: Range }) => void
}

export interface SlashMenuProps {
  items: SlashMenuItem[]
  command: (item: SlashMenuItem) => void
  selectedIndex: number
}

// Bubble menu types
export interface BubbleMenuButton {
  id: string
  icon: React.ReactNode
  title: string
  isActive: () => boolean
  command: () => void
}

// Re-export Tiptap types
export type { Editor, JSONContent } from '@tiptap/core'
export type { NodeViewProps, NodeViewRendererProps } from '@tiptap/react'
