import React from 'react'
import { createRoot, Root } from 'react-dom/client'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorView, NodeView, Decoration, DecorationSource } from 'prosemirror-view'

export interface ReactNodeViewProps {
  node: ProseMirrorNode
  view: EditorView
  getPos: () => number | undefined
  decorations: readonly Decoration[]
  innerDecorations: DecorationSource
  selected: boolean
  updateAttributes: (attrs: Record<string, any>) => void
}

export interface ReactNodeViewOptions {
  component: React.ComponentType<ReactNodeViewProps>
  contentAs?: string
  className?: string
  attrs?: Record<string, any>
}

/**
 * Creates a ProseMirror NodeView that renders a React component
 */
export class ReactNodeViewRenderer implements NodeView {
  dom: HTMLElement
  contentDOM?: HTMLElement
  private root: Root
  private component: React.ComponentType<ReactNodeViewProps>
  private node: ProseMirrorNode
  private view: EditorView
  private getPos: () => number | undefined
  private decorations: readonly Decoration[]
  private innerDecorations: DecorationSource
  private selected: boolean = false

  constructor(
    node: ProseMirrorNode,
    view: EditorView,
    getPos: () => number | undefined,
    decorations: readonly Decoration[],
    innerDecorations: DecorationSource,
    options: ReactNodeViewOptions
  ) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.decorations = decorations
    this.innerDecorations = innerDecorations
    this.component = options.component

    // Create container
    this.dom = document.createElement('div')
    this.dom.className = options.className || ''
    this.dom.setAttribute('data-node-view', node.type.name)

    // Create content container if needed
    if (options.contentAs) {
      this.contentDOM = document.createElement(options.contentAs)
      this.contentDOM.className = 'node-view-content'
    }

    // Create React root and render
    this.root = createRoot(this.dom)
    this.render()
  }

  private render() {
    const Component = this.component
    this.root.render(
      <Component
        node={this.node}
        view={this.view}
        getPos={this.getPos}
        decorations={this.decorations}
        innerDecorations={this.innerDecorations}
        selected={this.selected}
        updateAttributes={this.updateAttributes}
      />
    )
  }

  update(
    node: ProseMirrorNode,
    decorations: readonly Decoration[],
    innerDecorations: DecorationSource
  ): boolean {
    if (node.type !== this.node.type) {
      return false
    }
    this.node = node
    this.decorations = decorations
    this.innerDecorations = innerDecorations
    this.render()
    return true
  }

  selectNode() {
    this.selected = true
    this.dom.classList.add('ProseMirror-selectednode')
    this.render()
  }

  deselectNode() {
    this.selected = false
    this.dom.classList.remove('ProseMirror-selectednode')
    this.render()
  }

  updateAttributes = (attrs: Record<string, any>) => {
    const pos = this.getPos()
    if (pos === undefined) return

    const { tr } = this.view.state
    tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      ...attrs,
    })
    this.view.dispatch(tr)
  }

  destroy() {
    this.root.unmount()
  }

  // Prevent default content editing for atom nodes
  stopEvent() {
    return false
  }

  ignoreMutation() {
    return true
  }
}

/**
 * Factory function to create node view creators
 */
export function createReactNodeView(options: ReactNodeViewOptions) {
  return (
    node: ProseMirrorNode,
    view: EditorView,
    getPos: () => number | undefined,
    decorations: readonly Decoration[],
    innerDecorations: DecorationSource
  ) => {
    return new ReactNodeViewRenderer(node, view, getPos, decorations, innerDecorations, options)
  }
}
