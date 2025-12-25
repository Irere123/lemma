import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import type { Plugin } from 'prosemirror-state'

interface DropCursorOptions {
  color?: string
  width?: number
  class?: string
}

/**
 * Creates the drop cursor plugin for drag-and-drop operations
 */
export function createDropCursorPlugin(options: DropCursorOptions = {}): Plugin {
  return dropCursor({
    color: options.color || '#3b82f6',
    width: options.width || 2,
    class: options.class || 'pm-drop-cursor',
  })
}

/**
 * Creates the gap cursor plugin for navigating between blocks
 */
export function createGapCursorPlugin(): Plugin {
  return gapCursor()
}

/**
 * Creates both cursor plugins
 */
export function createCursorPlugins(options: DropCursorOptions = {}): Plugin[] {
  return [createDropCursorPlugin(options), createGapCursorPlugin()]
}
