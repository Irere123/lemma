import { describe, expect, test } from 'bun:test'
import { getContentSchema } from '@lemma/content/schema'
import type { Node as PMNode } from '@tiptap/pm/model'
import { EditorState, TextSelection } from '@tiptap/pm/state'

import { moveBlock } from '../src/components/editor/move-block'

const schema = getContentSchema()
const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const li = (text: string) => ({ type: 'listItem', content: [p(text)] })

function stateWithCaretIn(doc: object, needle: string) {
  const node = schema.nodeFromJSON(doc)
  let pos = -1
  node.descendants((child, at) => {
    if (pos < 0 && child.isText && child.text?.includes(needle)) pos = at + 1
  })
  return EditorState.create({ doc: node, selection: TextSelection.create(node, pos) })
}
const texts = (doc: PMNode) => {
  const out: string[] = []
  doc.descendants((n) => {
    if (n.isTextblock) out.push(n.textContent)
    return true
  })
  return out
}

describe('moveBlock', () => {
  test('moves a top-level block up and down, keeping the caret in it', () => {
    const state = stateWithCaretIn(
      { type: 'doc', content: [p('one'), p('two'), p('three')] },
      'two'
    )
    const up = moveBlock(state, -1)
    expect(up && texts(up.doc)).toEqual(['two', 'one', 'three'])
    expect(up?.selection.$from.parent.textContent).toBe('two')
    const down = moveBlock(state, 1)
    expect(down && texts(down.doc)).toEqual(['one', 'three', 'two'])
    expect(down?.selection.$from.parent.textContent).toBe('two')
  })

  test('moves a list item within its list', () => {
    const doc = {
      type: 'doc',
      content: [p('intro'), { type: 'bulletList', content: [li('a'), li('b')] }],
    }
    const tr = moveBlock(stateWithCaretIn(doc, 'b'), -1)
    expect(tr && texts(tr.doc)).toEqual(['intro', 'b', 'a'])
    // Already first in its list: nothing to do.
    expect(moveBlock(stateWithCaretIn(doc, 'a'), -1)).toBeNull()
  })

  test('never moves past the footnotes', () => {
    const doc = {
      type: 'doc',
      content: [
        p('body'),
        {
          type: 'footnotes',
          content: [{ type: 'footnote', attrs: { id: 'n1' }, content: [p('note')] }],
        },
      ],
    }
    expect(moveBlock(stateWithCaretIn(doc, 'body'), 1)).toBeNull()
    expect(moveBlock(stateWithCaretIn(doc, 'note'), -1)).toBeNull()
  })
})
