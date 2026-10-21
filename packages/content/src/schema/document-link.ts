import { mergeAttributes, Node } from '@tiptap/core'

// A link to another of the writer's documents (a note, chapter or post), and
// optionally to one block in it. It stores the target's id, so renaming or
// moving the target never breaks it; `title` is the last known title, shown
// when the target can't be looked up (e.g. it was deleted).

export const DocumentLink = Node.create({
  name: 'documentLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      documentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-document-id'),
        renderHTML: (attributes) =>
          attributes.documentId ? { 'data-document-id': attributes.documentId as string } : {},
      },
      blockId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-block-id') || null,
        renderHTML: (attributes) =>
          attributes.blockId ? { 'data-block-id': attributes.blockId as string } : {},
      },
      title: {
        default: '',
        parseHTML: (element) =>
          element.getAttribute('data-title') ?? element.textContent?.trim() ?? '',
        renderHTML: (attributes) => ({ 'data-title': (attributes.title as string) ?? '' }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-document-link]', priority: 1000 }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'a',
      mergeAttributes(HTMLAttributes, { 'data-document-link': '' }),
      (node.attrs.title as string) || 'Untitled',
    ]
  },

  renderText({ node }) {
    return (node.attrs.title as string) || ''
  },
})
