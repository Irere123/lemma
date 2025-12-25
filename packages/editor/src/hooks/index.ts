export { useEditor, type UseEditorOptions, type UseEditorReturn } from './useEditor'

// Re-export the base hooks (require view parameter)
export {
  useEditorState as useEditorStateWithView,
  useMarkActive as useMarkActiveWithView,
  useNodeActive as useNodeActiveWithView,
  useSelectionPosition as useSelectionPositionWithView,
  useSelectionRect as useSelectionRectWithView,
} from './useEditorState'

// Context-aware hooks
import { useEditorView } from '../context/EditorContext'
import {
  useEditorState as useEditorStateWithView,
  useMarkActive as useMarkActiveWithView,
  useNodeActive as useNodeActiveWithView,
  useSelectionPosition as useSelectionPositionWithView,
  useSelectionRect as useSelectionRectWithView,
} from './useEditorState'

/**
 * Hook to get the current editor state (uses context)
 */
export function useEditorState() {
  const view = useEditorView()
  return useEditorStateWithView(view)
}

/**
 * Hook to check if a mark is active in the current selection (uses context)
 */
export function useMarkActive(markName: string) {
  const view = useEditorView()
  return useMarkActiveWithView(view, markName)
}

/**
 * Hook to check if a node type is active in the current selection (uses context)
 */
export function useNodeActive(nodeName: string, attrs?: Record<string, any>) {
  const view = useEditorView()
  return useNodeActiveWithView(view, nodeName, attrs)
}

/**
 * Hook to get the current selection position (uses context)
 */
export function useSelectionPosition() {
  const view = useEditorView()
  return useSelectionPositionWithView(view)
}

/**
 * Hook to get the current selection as DOM rect (uses context)
 */
export function useSelectionRect() {
  const view = useEditorView()
  return useSelectionRectWithView(view)
}
