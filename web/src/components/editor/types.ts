// Editor types - can be safely imported on server since they don't depend on ProseMirror

export interface BrainEditorProps {
  documentId: string
  placeholder?: string
  className?: string
  autoFocus?: boolean
  onReady?: () => void
  /** Called when editor content changes */
  onChange?: () => void
  /** Deprecated - not used in ProseMirror version */
  highlightedPath?: unknown
}

export interface BrainReadOnlyEditorProps {
  content: unknown // Can be Slate Descendant[] or ProseMirror JSON
  className?: string
}

export interface BrainTitleProps {
  documentId: string
  placeholder?: string
  className?: string
  /** Called when title changes */
  onChange?: (title: string) => void
  /** Called when subtitle changes */
  onChangeSubtitle?: (subtitle: string) => void
}

// Alias types for backwards compatibility
export type EditorProps = BrainEditorProps
export type TitleProps = BrainTitleProps
