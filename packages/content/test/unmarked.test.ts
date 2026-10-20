import { describe, expect, test } from 'bun:test'
import { Editor, type JSONContent } from '@tiptap/core'

import { contentExtensions, validateContent } from '../src/schema'

const sentence: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Energy ' },
        { type: 'inlineMath', attrs: { latex: 'E = mc^2' } },
        { type: 'hardBreak' },
        { type: 'text', text: 'and a note' },
        { type: 'footnoteReference', attrs: { id: 'fn-1' } },
      ],
    },
    {
      type: 'footnotes',
      content: [
        {
          type: 'footnote',
          attrs: { id: 'fn-1' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note.' }] }],
        },
      ],
    },
  ],
}

const inline = (editor: Editor) => editor.getJSON().content?.[0]?.content ?? []

describe('equations, footnote references and line breaks carry no marks', () => {
  test('bolding a whole sentence bolds its text only', () => {
    const editor = new Editor({ extensions: contentExtensions, content: sentence })
    editor
      .chain()
      .setTextSelection({ from: 1, to: editor.state.doc.firstChild!.nodeSize - 1 })
      .setBold()
      .run()
    const nodes = inline(editor)
    expect(nodes.filter((n) => n.type === 'text').every((n) => n.marks?.[0]?.type === 'bold')).toBe(
      true
    )
    expect(nodes.filter((n) => n.type !== 'text').map((n) => n.marks ?? [])).toEqual([[], [], []])
    editor.destroy()
  })

  test('also when other steps in the same transaction move things first', () => {
    const editor = new Editor({ extensions: contentExtensions, content: sentence })
    editor
      .chain()
      .insertContentAt(1, 'Before: ')
      .setTextSelection({ from: 1, to: editor.state.doc.firstChild!.nodeSize + 7 })
      .setMark('highlight', { color: '#fef08a' })
      .run()
    const nodes = inline(editor)
    expect(nodes.find((n) => n.type === 'inlineMath')?.marks ?? []).toEqual([])
    expect(nodes.find((n) => n.type === 'text')?.marks?.[0]?.type).toBe('highlight')
    editor.destroy()
  })

  test('validation strips them from stored or submitted JSON', () => {
    const doc = validateContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'inlineMath', attrs: { latex: 'x' }, marks: [{ type: 'bold' }] },
            { type: 'hardBreak', marks: [{ type: 'italic' }] },
            { type: 'text', text: 'y', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    })
    const nodes = doc.content?.[0]?.content ?? []
    expect(nodes.map((n) => n.marks?.length ?? 0)).toEqual([0, 0, 1])
  })
})
