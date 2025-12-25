import { setBlockType } from 'prosemirror-commands'
import type { NodeType } from 'prosemirror-model'
import { wrapInList } from 'prosemirror-schema-list'
import type { EditorState, Transaction } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { createNodeId, schema } from '../schema'

type Command = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
  view?: EditorView
) => boolean

/**
 * Set paragraph block
 */
export const setParagraph: Command = (state, dispatch, view) => {
  return setBlockType(schema.nodes.paragraph, { id: createNodeId() })(state, dispatch, view)
}

/**
 * Set heading with level
 */
export function setHeading(level: 1 | 2 | 3 | 4): Command {
  return (state, dispatch, view) => {
    return setBlockType(schema.nodes.heading, { level, id: createNodeId() })(state, dispatch, view)
  }
}

/**
 * Toggle heading (converts to paragraph if already heading)
 */
export function toggleHeading(level: 1 | 2 | 3 | 4): Command {
  return (state, dispatch, view) => {
    const { $from } = state.selection
    const node = $from.parent

    if (node.type === schema.nodes.heading && node.attrs.level === level) {
      return setParagraph(state, dispatch, view)
    }

    return setHeading(level)(state, dispatch, view)
  }
}

/**
 * Wrap selection in bullet list
 */
export const wrapInBulletList: Command = (state, dispatch, _view) => {
  return wrapInList(schema.nodes.bulletList, { id: createNodeId() })(state, dispatch)
}

/**
 * Wrap selection in ordered list
 */
export const wrapInOrderedList: Command = (state, dispatch, _view) => {
  return wrapInList(schema.nodes.orderedList, { id: createNodeId() })(state, dispatch)
}

/**
 * Set blockquote
 */
export const setBlockquote: Command = (state, dispatch, view) => {
  return setBlockType(schema.nodes.blockquote, { id: createNodeId() })(state, dispatch, view)
}

/**
 * Set code block with optional language
 */
export function setCodeBlock(language?: string): Command {
  return (state, dispatch, view) => {
    return setBlockType(schema.nodes.codeBlock, { language, id: createNodeId() })(
      state,
      dispatch,
      view
    )
  }
}

/**
 * Insert a node at the current selection
 */
export function insertNode(nodeType: NodeType, attrs?: Record<string, any>): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection
    const node = nodeType.create({ ...attrs, id: attrs?.id || createNodeId() })

    if (dispatch) {
      const tr = state.tr.replaceWith($from.pos, $to.pos, node)
      dispatch(tr)
    }

    return true
  }
}

/**
 * Insert divider
 */
export const insertDivider: Command = (state, dispatch) => {
  const divider = schema.nodes.divider.create({ id: createNodeId() })
  const paragraph = schema.nodes.paragraph.create({ id: createNodeId() })

  if (dispatch) {
    const { $from } = state.selection
    const tr = state.tr.replaceWith($from.pos, $from.pos, divider).insert($from.pos + 1, paragraph)
    dispatch(tr.scrollIntoView())
  }

  return true
}

/**
 * Insert image
 */
export function insertImage(src: string, alt?: string, caption?: string): Command {
  return (state, dispatch) => {
    const image = schema.nodes.image.create({
      src,
      alt,
      caption,
      id: createNodeId(),
    })

    if (dispatch) {
      const { $from } = state.selection
      const tr = state.tr.replaceWith($from.pos, $from.pos, image)
      dispatch(tr.scrollIntoView())
    }

    return true
  }
}

/**
 * Insert callout with variant
 */
export function insertCallout(variant: 'info' | 'warning' | 'success' | 'error' = 'info'): Command {
  return (state, dispatch) => {
    const paragraph = schema.nodes.paragraph.create({ id: createNodeId() })
    const callout = schema.nodes.callout.create({ variant, id: createNodeId() }, paragraph)

    if (dispatch) {
      const { $from } = state.selection
      const tr = state.tr.replaceWith($from.pos, $from.pos, callout)
      dispatch(tr.scrollIntoView())
    }

    return true
  }
}

/**
 * Insert toggle block
 */
export function insertToggle(open: boolean = false): Command {
  return (state, dispatch) => {
    const paragraph = schema.nodes.paragraph.create({ id: createNodeId() })
    const toggle = schema.nodes.toggle.create({ open, id: createNodeId() }, paragraph)

    if (dispatch) {
      const { $from } = state.selection
      const tr = state.tr.replaceWith($from.pos, $from.pos, toggle)
      dispatch(tr.scrollIntoView())
    }

    return true
  }
}

/**
 * Insert task list
 */
export const insertTaskList: Command = (state, dispatch) => {
  const paragraph = schema.nodes.paragraph.create({ id: createNodeId() })
  const taskItem = schema.nodes.taskItem.create({ checked: false, id: createNodeId() }, paragraph)
  const taskList = schema.nodes.taskList.create({ id: createNodeId() }, taskItem)

  if (dispatch) {
    const { $from } = state.selection
    const tr = state.tr.replaceWith($from.pos, $from.pos, taskList)
    dispatch(tr.scrollIntoView())
  }

  return true
}

/**
 * Check if current selection is in a specific node type
 */
export function isNodeActive(
  state: EditorState,
  nodeType: NodeType,
  attrs?: Record<string, any>
): boolean {
  const { $from, to } = state.selection

  let found = false
  state.doc.nodesBetween($from.pos, to, (node) => {
    if (node.type === nodeType) {
      if (attrs) {
        found = Object.entries(attrs).every(([key, value]) => node.attrs[key] === value)
      } else {
        found = true
      }
    }
  })

  return found
}
