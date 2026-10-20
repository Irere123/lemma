// Browser bundle for paste-chromium.ts: the harness plus a real editor paste,
// exposed on window.__paste.

import { Editor } from '@tiptap/core'

import { contentExtensions } from '../src/schema'
import { normalizePastedHTML, PasteCleanup } from '../src/schema/paste'
import {
  blankParagraphs,
  classifyElement,
  classifyHTML,
  nodeCounts,
  pasteHTML,
} from './paste-harness'

function schemaPaste(html: string, normalize: boolean) {
  const result = pasteHTML(html, { normalize })
  return {
    result: classifyElement(result.dom),
    blank: blankParagraphs(result.slice.content),
    nodes: nodeCounts(result.slice.content),
    droppedImages: result.droppedImages,
  }
}

/** The whole paste path: a Tiptap editor on the content schema, PasteCleanup, a paste event. */
function editorPaste(html: string, text: string) {
  const element = document.createElement('div')
  document.body.append(element)
  let droppedImages = 0
  const editor = new Editor({
    element,
    extensions: [
      ...contentExtensions,
      PasteCleanup.configure({ onDroppedImages: (count) => (droppedImages += count) }),
    ],
  })
  editor.commands.focus('end')
  const data = new DataTransfer()
  if (html) data.setData('text/html', html)
  if (text) data.setData('text/plain', text)
  editor.view.dom.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
  )
  const content = editor.state.doc.content
  const out = {
    result: classifyElement(editor.view.dom as HTMLElement),
    blank: blankParagraphs(content),
    nodes: nodeCounts(content),
    droppedImages,
    json: editor.getJSON(),
  }
  editor.destroy()
  element.remove()
  return out
}

function timeNormalize(html: string, runs: number) {
  normalizePastedHTML(html)
  const start = performance.now()
  for (let i = 0; i < runs; i++) normalizePastedHTML(html)
  return (performance.now() - start) / runs
}

/** The floor: the DOMParser round trip normalizePastedHTML does on top of its rules. */
function timeParse(html: string, runs: number) {
  const start = performance.now()
  for (let i = 0; i < runs; i++)
    void new DOMParser().parseFromString(html, 'text/html').body.innerHTML
  return (performance.now() - start) / runs
}

Object.assign(globalThis, {
  __paste: {
    classifyHTML,
    schemaPaste,
    editorPaste,
    timeNormalize,
    timeParse,
    normalizePastedHTML,
  },
})
