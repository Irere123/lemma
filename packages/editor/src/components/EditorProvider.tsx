import { useMemo, type ReactNode } from 'react'
import type { EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { EditorContext, type EditorContextValue } from '../context/EditorContext'

export interface EditorProviderProps {
  /** The ProseMirror view instance */
  view: EditorView | null
  /** Current editor state */
  state: EditorState | null
  /** Whether the editor is focused */
  isFocused?: boolean
  /** Whether the editor is empty */
  isEmpty?: boolean
  /** Children components */
  children: ReactNode
}

/**
 * EditorProvider component for cases where you manage your own EditorView
 * via useEditor hook and want to provide context to child components.
 */
export function EditorProvider({
  view,
  state,
  isFocused = false,
  isEmpty = true,
  children,
}: EditorProviderProps) {
  const contextValue = useMemo<EditorContextValue>(
    () => ({
      view,
      state,
      isFocused,
      isEmpty,
    }),
    [view, state, isFocused, isEmpty]
  )

  return <EditorContext.Provider value={contextValue}>{children}</EditorContext.Provider>
}
