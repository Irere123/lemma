import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorView, NodeView, Decoration, DecorationSource } from 'prosemirror-view'
import { createReactNodeView } from './ReactNodeView'
import { CodeBlockView, codeBlockStyles } from './CodeBlockView'
import { ImageView, imageStyles } from './ImageView'
import { CalloutView, calloutStyles } from './CalloutView'
import { ToggleView, toggleStyles } from './ToggleView'
import { TaskItemView, taskItemStyles } from './TaskItemView'

export { ReactNodeViewRenderer, createReactNodeView } from './ReactNodeView'
export type { ReactNodeViewProps, ReactNodeViewOptions } from './ReactNodeView'
export { CodeBlockView, codeBlockStyles } from './CodeBlockView'
export { ImageView, imageStyles } from './ImageView'
export { CalloutView, calloutStyles } from './CalloutView'
export { ToggleView, toggleStyles } from './ToggleView'
export { TaskItemView, taskItemStyles } from './TaskItemView'

/**
 * All node view styles combined
 */
export const nodeViewStyles = `
${codeBlockStyles}
${imageStyles}
${calloutStyles}
${toggleStyles}
${taskItemStyles}
`

/**
 * Node view factory type
 */
export type NodeViewFactory = (
  node: ProseMirrorNode,
  view: EditorView,
  getPos: () => number | undefined,
  decorations: readonly Decoration[],
  innerDecorations: DecorationSource
) => NodeView

/**
 * Creates all node views for the editor
 */
export function createNodeViews(): Record<string, NodeViewFactory> {
  return {
    codeBlock: createReactNodeView({
      component: CodeBlockView,
      className: 'node-view-wrapper code-block-wrapper',
    }),
    image: createReactNodeView({
      component: ImageView,
      className: 'node-view-wrapper image-wrapper',
    }),
    callout: createReactNodeView({
      component: CalloutView,
      className: 'node-view-wrapper callout-wrapper',
      contentAs: 'div',
    }),
    toggle: createReactNodeView({
      component: ToggleView,
      className: 'node-view-wrapper toggle-wrapper',
      contentAs: 'div',
    }),
    taskItem: createReactNodeView({
      component: TaskItemView,
      className: 'node-view-wrapper task-item-wrapper',
      contentAs: 'div',
    }),
  }
}

/**
 * Injects node view styles into the document
 */
export function injectNodeViewStyles(): void {
  const styleId = 'prosemirror-node-view-styles'

  // Check if styles are already injected
  if (document.getElementById(styleId)) {
    return
  }

  const styleElement = document.createElement('style')
  styleElement.id = styleId
  styleElement.textContent = nodeViewStyles
  document.head.appendChild(styleElement)
}
