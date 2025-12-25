import { useEffect, useState } from 'react'
import type { EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

/**
 * Hook to subscribe to editor state changes
 */
export function useEditorState(view: EditorView | null): EditorState | null {
  const [state, setState] = useState<EditorState | null>(view?.state || null)

  useEffect(() => {
    if (!view) {
      setState(null)
      return
    }

    setState(view.state)

    // We need to override dispatchTransaction to track state changes
    const originalDispatch = view.dispatch.bind(view)

    // Create a patched dispatch that updates our state
    const patchedDispatch = (tr: any) => {
      originalDispatch(tr)
      setState(view.state)
    }

    // Replace the dispatch method
    ;(view as any).dispatch = patchedDispatch

    return () => {
      // Restore original dispatch
      ;(view as any).dispatch = originalDispatch
    }
  }, [view])

  return state
}

/**
 * Hook to check if a mark is active in the current selection
 */
export function useMarkActive(view: EditorView | null, markName: string): boolean {
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    if (!view) {
      setIsActive(false)
      return
    }

    const checkMark = () => {
      const { state } = view
      const { from, $from, to, empty } = state.selection
      const markType = state.schema.marks[markName]

      if (!markType) {
        setIsActive(false)
        return
      }

      if (empty) {
        setIsActive(!!markType.isInSet(state.storedMarks || $from.marks()))
      } else {
        setIsActive(state.doc.rangeHasMark(from, to, markType))
      }
    }

    // Check initially
    checkMark()

    // Subscribe to state changes
    const originalDispatch = view.dispatch.bind(view)
    ;(view as any).dispatch = (tr: any) => {
      originalDispatch(tr)
      checkMark()
    }

    return () => {
      ;(view as any).dispatch = originalDispatch
    }
  }, [view, markName])

  return isActive
}

/**
 * Hook to check if a node type is active in the current selection
 */
export function useNodeActive(
  view: EditorView | null,
  nodeName: string,
  attrs?: Record<string, any>
): boolean {
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    if (!view) {
      setIsActive(false)
      return
    }

    const checkNode = () => {
      const { state } = view
      const { selection } = state
      const nodeType = state.schema.nodes[nodeName]

      if (!nodeType) {
        setIsActive(false)
        return
      }

      // Find if the current selection is in a node of the given type
      let found = false
      const { $from, $to } = selection

      state.doc.nodesBetween($from.pos, $to.pos, (node) => {
        if (node.type === nodeType) {
          if (attrs) {
            // Check if attributes match
            found = Object.entries(attrs).every(([key, value]) => node.attrs[key] === value)
          } else {
            found = true
          }
        }
      })

      setIsActive(found)
    }

    // Check initially
    checkNode()

    // Subscribe to state changes
    const originalDispatch = view.dispatch.bind(view)
    ;(view as any).dispatch = (tr: any) => {
      originalDispatch(tr)
      checkNode()
    }

    return () => {
      ;(view as any).dispatch = originalDispatch
    }
  }, [view, nodeName, JSON.stringify(attrs)])

  return isActive
}

/**
 * Hook to get the current selection position
 */
export function useSelectionPosition(view: EditorView | null): {
  from: number
  to: number
  empty: boolean
  anchor: number
  head: number
} | null {
  const [position, setPosition] = useState<{
    from: number
    to: number
    empty: boolean
    anchor: number
    head: number
  } | null>(null)

  useEffect(() => {
    if (!view) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      const { selection } = view.state
      setPosition({
        from: selection.from,
        to: selection.to,
        empty: selection.empty,
        anchor: selection.anchor,
        head: selection.head,
      })
    }

    // Update initially
    updatePosition()

    // Subscribe to state changes
    const originalDispatch = view.dispatch.bind(view)
    ;(view as any).dispatch = (tr: any) => {
      originalDispatch(tr)
      updatePosition()
    }

    return () => {
      ;(view as any).dispatch = originalDispatch
    }
  }, [view])

  return position
}

/**
 * Hook to get the current selection as DOM rect
 */
export function useSelectionRect(view: EditorView | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!view) {
      setRect(null)
      return
    }

    const updateRect = () => {
      const { selection } = view.state
      if (selection.empty) {
        // Get cursor position
        const coords = view.coordsAtPos(selection.from)
        setRect(new DOMRect(coords.left, coords.top, 0, coords.bottom - coords.top))
      } else {
        // Get selection range
        const start = view.coordsAtPos(selection.from)
        const end = view.coordsAtPos(selection.to)
        setRect(
          new DOMRect(
            Math.min(start.left, end.left),
            Math.min(start.top, end.top),
            Math.abs(end.left - start.left),
            Math.max(start.bottom, end.bottom) - Math.min(start.top, end.top)
          )
        )
      }
    }

    // Update initially
    updateRect()

    // Subscribe to state changes
    const originalDispatch = view.dispatch.bind(view)
    ;(view as any).dispatch = (tr: any) => {
      originalDispatch(tr)
      requestAnimationFrame(updateRect)
    }

    // Also update on scroll
    const handleScroll = () => requestAnimationFrame(updateRect)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      ;(view as any).dispatch = originalDispatch
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [view])

  return rect
}
