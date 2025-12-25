import { Plugin, PluginKey } from 'prosemirror-state'
import { v4 as uuid } from 'uuid'

export const nodeIdPluginKey = new PluginKey('nodeId')

/**
 * Creates a plugin that ensures all block nodes have unique IDs
 */
export function createNodeIdPlugin(): Plugin {
  return new Plugin({
    key: nodeIdPluginKey,

    appendTransaction(transactions, _oldState, newState) {
      // Only process if there were actual changes
      if (!transactions.some((tr) => tr.docChanged)) {
        return null
      }

      let modified = false
      const tr = newState.tr

      newState.doc.descendants((node, pos) => {
        // Only process block nodes that can have an ID
        if (node.isBlock && node.attrs && node.attrs.id === null) {
          const attrs = { ...node.attrs, id: uuid() }
          tr.setNodeMarkup(pos, undefined, attrs)
          modified = true
        }
      })

      return modified ? tr : null
    },
  })
}

/**
 * Helper to get node by ID
 */
export function getNodeById(doc: any, id: string): { node: any; pos: number } | null {
  let result: { node: any; pos: number } | null = null

  doc.descendants((node: any, pos: number) => {
    if (node.attrs?.id === id) {
      result = { node, pos }
      return false // Stop traversal
    }
  })

  return result
}

/**
 * Helper to get all node IDs in document
 */
export function getAllNodeIds(doc: any): string[] {
  const ids: string[] = []

  doc.descendants((node: any) => {
    if (node.attrs?.id) {
      ids.push(node.attrs.id)
    }
  })

  return ids
}
