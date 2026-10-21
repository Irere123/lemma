import type { Node as PMNode } from '@tiptap/pm/model'
import type { NodeView } from '@tiptap/pm/view'

import { isNumericStyle, type ResearchStorage } from './research'

/**
 * The bibliography block: the formatted list of what the document cites, in
 * its style. Read-only (it's generated); re-rendered whenever the research
 * plugin recomputes.
 */
export function bibliographyView(storage: ResearchStorage) {
  return ({ node: initial }: { node: PMNode }): NodeView => {
    let node = initial
    const dom = document.createElement('section')
    dom.className = 'bibliography'
    dom.contentEditable = 'false'
    dom.setAttribute('data-bibliography', '')
    const heading = document.createElement('h2')
    const body = document.createElement('div')
    dom.appendChild(heading)
    dom.appendChild(body)

    const render = () => {
      heading.textContent = (node.attrs.title as string) || 'References'
      const entries = storage.bibliography
      if (entries.length === 0) {
        body.innerHTML = ''
        const hint = document.createElement('p')
        hint.className = 'bibliography-empty'
        hint.textContent = 'Sources you cite are listed here, in the document’s citation style.'
        body.appendChild(hint)
        return
      }
      const list = document.createElement(isNumericStyle(storage.style) ? 'ol' : 'ul')
      list.className = 'references'
      for (const entry of entries) {
        const item = document.createElement('li')
        // The citation formatter escapes every field; its HTML is <i>/<sup> only.
        item.innerHTML = entry.html
        list.appendChild(item)
      }
      body.replaceChildren(list)
    }

    storage.listeners.add(render)
    render()
    return {
      dom,
      update: (updated) => {
        if (updated.type !== node.type) return false
        node = updated
        render()
        return true
      },
      ignoreMutation: () => true,
      stopEvent: () => false,
      destroy: () => {
        storage.listeners.delete(render)
      },
    }
  }
}
