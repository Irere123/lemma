import { Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core'

export interface NoteLinkOptions {
  HTMLAttributes: Record<string, any>
  onNoteLinkClick?: (noteId: string, noteTitle: string) => void
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteLink: {
      setNoteLink: (attributes: { noteId: string; noteTitle: string }) => ReturnType
      toggleNoteLink: (attributes: { noteId: string; noteTitle: string }) => ReturnType
      unsetNoteLink: () => ReturnType
    }
  }
}

// Matches [[note title]] or [[noteId|note title]]
export const noteLinkInputRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/
export const noteLinkPasteRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

export const NoteLink = Mark.create<NoteLinkOptions>({
  name: 'noteLink',

  priority: 1000,

  inclusive: false,

  addOptions() {
    return {
      HTMLAttributes: {},
      onNoteLinkClick: undefined,
    }
  },

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-note-id'),
        renderHTML: (attributes) => ({
          'data-note-id': attributes.noteId,
        }),
      },
      noteTitle: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-note-title'),
        renderHTML: (attributes) => ({
          'data-note-title': attributes.noteTitle,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-type="note-link"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'note-link',
        class: 'note-link',
        href: `#${HTMLAttributes['data-note-id']}`,
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setNoteLink:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes)
        },
      toggleNoteLink:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes)
        },
      unsetNoteLink:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },

  addInputRules() {
    return [
      markInputRule({
        find: noteLinkInputRegex,
        type: this.type,
        getAttributes: (match) => {
          const [, first, second] = match
          // If there's a second capture group, first is noteId and second is title
          // Otherwise, first is both
          if (second) {
            return { noteId: first, noteTitle: second }
          }
          return { noteId: first, noteTitle: first }
        },
      }),
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: noteLinkPasteRegex,
        type: this.type,
        getAttributes: (match) => {
          const [, first, second] = match
          if (second) {
            return { noteId: first, noteTitle: second }
          }
          return { noteId: first, noteTitle: first }
        },
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-l': () => {
        // This will be handled by the UI to open note link picker
        return false
      },
    }
  },
})

export default NoteLink
