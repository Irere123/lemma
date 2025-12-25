import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import type { EditorView } from 'prosemirror-view'

export interface EditorContentProps {
  /** The editor view instance */
  view: EditorView | null
  /** Callback to set the container element */
  setContainer: (element: HTMLElement | null) => void
  /** Additional class names */
  className?: string
  /** Whether the editor is editable */
  editable?: boolean
}

export interface EditorContentHandle {
  focus: () => void
  blur: () => void
}

/**
 * Renders the ProseMirror editor view
 */
export const EditorContent = forwardRef<EditorContentHandle, EditorContentProps>(
  function EditorContent({ view, setContainer, className = '', editable = true }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)

    // Set the container when mounted
    useEffect(() => {
      if (containerRef.current) {
        setContainer(containerRef.current)
      }

      return () => {
        setContainer(null)
      }
    }, [setContainer])

    // Expose focus/blur methods
    useImperativeHandle(
      ref,
      () => ({
        focus: () => view?.focus(),
        blur: () => (view?.dom as HTMLElement)?.blur(),
      }),
      [view]
    )

    return (
      <div
        ref={containerRef}
        className={`pm-editor-content ${className}`}
        data-editable={editable}
      />
    )
  }
)

EditorContent.displayName = 'EditorContent'
