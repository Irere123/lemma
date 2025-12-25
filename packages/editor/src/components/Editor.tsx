import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { forwardRef, useImperativeHandle, useMemo, type ReactNode } from 'react'
import { EditorContext, type EditorContextValue } from '../context/EditorContext'
import { useEditor, type UseEditorOptions } from '../hooks/useEditor'
import { EditorContent } from './EditorContent'

export interface EditorProps extends Omit<UseEditorOptions, 'content'> {
  /** Document ID for store integration */
  documentId?: string
  /** Initial content (ProseMirror Node) */
  initialContent?: ProseMirrorNode
  /** Called when document changes */
  onChange?: (doc: ProseMirrorNode) => void
  /** Additional class name for the editor container */
  className?: string
  /** Children (menus, toolbars, etc.) */
  children?: ReactNode
}

export interface EditorHandle {
  /** Focus the editor */
  focus: () => void
  /** Blur the editor */
  blur: () => void
  /** Get the current document */
  getDocument: () => ProseMirrorNode | null
  /** Set new content */
  setContent: (content: ProseMirrorNode) => void
  /** Check if editor is empty */
  isEmpty: boolean
}

/**
 * Main Editor component
 */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  {
    initialContent,
    onChange,
    className = '',
    children,
    placeholder,
    editable = true,
    autoFocus = false,
  },
  ref
) {
  const { view, state, setContainer, setContent, isFocused, focus, blur, isEmpty, getDocument } =
    useEditor({
      content: initialContent,
      onUpdate: onChange,
      placeholder,
      editable,
      autoFocus,
    })

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      focus,
      blur,
      getDocument,
      setContent,
      isEmpty,
    }),
    [focus, blur, getDocument, setContent, isEmpty]
  )

  // Context value for children
  const contextValue = useMemo<EditorContextValue>(
    () => ({
      view,
      state,
      isFocused,
      isEmpty,
    }),
    [view, state, isFocused, isEmpty]
  )

  return (
    <EditorContext.Provider value={contextValue}>
      <div className={`pm-editor ${className}`} data-focused={isFocused} data-empty={isEmpty}>
        {children}
        <EditorContent
          view={view}
          setContainer={setContainer}
          editable={editable}
          className='pm-editor-editable focus:outline-none'
        />
      </div>
    </EditorContext.Provider>
  )
})

Editor.displayName = 'Editor'
