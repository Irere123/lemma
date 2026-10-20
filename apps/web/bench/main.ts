import '../src/app.css'

import { createUndoManager } from '@lemma/content/yjs'
import { Editor, type JSONContent } from '@tiptap/core'
import * as Y from 'yjs'

import { createEditorExtensions } from '../src/components/editor/extensions'

// Deterministic prose: ~35-word paragraphs, a heading every 30 of them, so a
// "100k" document has the block count of a real book.
const WORDS =
  'the of and to in that was he it his with as for had you not be her on at by which have or from this him but all she they were my are me one their so an said them we who would been will no when there if more out up into do any your what has man could other than our some very time upon about may its only now like little then can should made did us such a great before must two these see know over much down after first mr good men own never most old shall day where those came come himself way work life without go make well through being long say might how am too even def under us left'.split(
    ' '
  )

function buildDoc(words: number): JSONContent {
  const content: JSONContent[] = []
  let seed = 1
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed
  }
  let written = 0
  let paragraphs = 0
  while (written < words) {
    if (paragraphs % 30 === 0) {
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: `Chapter ${paragraphs / 30 + 1}` }],
      })
    }
    const count = Math.min(35, words - written)
    const text = Array.from({ length: count }, () => WORDS[next() % WORDS.length]).join(' ')
    content.push({ type: 'paragraph', content: [{ type: 'text', text: `${text}.` }] })
    written += count
    paragraphs++
  }
  return { type: 'doc', content }
}

const words = Number(new URLSearchParams(location.search).get('words') ?? 1000)
const doc = new Y.Doc()
const element = document.querySelector<HTMLElement>('#editor')
if (!element) throw new Error('#editor missing')
const editor = new Editor({
  element,
  extensions: createEditorExtensions({
    doc,
    undoManager: createUndoManager(doc),
    onEditMath: () => {},
  }),
  editorProps: { attributes: { class: 'writer-prose focus:outline-none' } },
})
editor.commands.setContent(buildDoc(words))
Object.assign(window, { __editor: editor, __ready: true })
