import { createContext, useContext } from 'react'
import type { EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

export interface EditorContextValue {
  /** The ProseMirror view instance */
  view: EditorView | null
  /** Current editor state */
  state: EditorState | null
  /** Whether the editor is focused */
  isFocused: boolean
  /** Whether the editor is empty */
  isEmpty: boolean
}

export const EditorContext = createContext<EditorContextValue | null>(null)

/**
 * Hook to access the editor context
 */
export function useEditorContext(): EditorContextValue {
  const context = useContext(EditorContext)

  if (!context) {
    throw new Error('useEditorContext must be used within an Editor component')
  }

  return context
}

/**
 * Hook to access the editor view (with null check)
 */
export function useEditorView(): EditorView | null {
  const context = useContext(EditorContext)
  return context?.view || null
}
