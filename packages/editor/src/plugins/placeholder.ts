import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const placeholderPluginKey = new PluginKey('placeholder')

interface PlaceholderOptions {
  placeholder?: string
  emptyNodeClass?: string
}

/**
 * Creates a placeholder plugin that shows text when the editor is empty
 */
export function createPlaceholderPlugin(options: PlaceholderOptions = {}): Plugin {
  const { placeholder = 'Start writing...', emptyNodeClass = 'is-empty' } = options

  return new Plugin({
    key: placeholderPluginKey,

    props: {
      decorations(state) {
        const doc = state.doc

        // Check if document is empty (only has one empty paragraph)
        if (
          doc.childCount === 1 &&
          doc.firstChild?.isTextblock &&
          doc.firstChild.content.size === 0
        ) {
          const decoration = Decoration.node(0, doc.firstChild.nodeSize, {
            class: emptyNodeClass,
            'data-placeholder': placeholder,
          })

          return DecorationSet.create(doc, [decoration])
        }

        return DecorationSet.empty
      },
    },
  })
}

/**
 * CSS for placeholder (to be included in styles)
 */
export const placeholderStyles = `
  .ProseMirror .is-empty::before {
    content: attr(data-placeholder);
    float: left;
    color: #adb5bd;
    pointer-events: none;
    height: 0;
  }
`
