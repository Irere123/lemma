import { mergeAttributes, Node, wrappingInputRule } from '@tiptap/core'

export interface ToggleOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggle: {
      setToggle: () => ReturnType
      toggleToggle: () => ReturnType
      setToggleOpen: (open: boolean) => ReturnType
    }
  }
}

export const Toggle = Node.create<ToggleOptions>({
  name: 'toggle',

  group: 'block',

  content: 'block+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-open') !== 'false',
        renderHTML: (attributes) => ({
          'data-open': attributes.open ? 'true' : 'false',
        }),
      },
      summary: {
        default: 'Toggle',
        parseHTML: (element) => element.getAttribute('data-summary') || 'Toggle',
        renderHTML: (attributes) => ({
          'data-summary': attributes.summary,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'details[data-type="toggle"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { open, summary, ...rest } = HTMLAttributes
    return [
      'details',
      mergeAttributes(this.options.HTMLAttributes, rest, {
        'data-type': 'toggle',
        'data-open': open ? 'true' : 'false',
        'data-summary': summary,
        open: open ? 'open' : null,
        class: 'toggle',
      }),
      ['summary', {}, summary || 'Toggle'],
      ['div', { class: 'toggle-content' }, 0],
    ]
  },

  addCommands() {
    return {
      setToggle:
        () =>
        ({ commands }) => {
          return commands.wrapIn(this.name)
        },
      toggleToggle:
        () =>
        ({ commands }) => {
          return commands.toggleWrap(this.name)
        },
      setToggleOpen:
        (open) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { open })
        },
    }
  },

  addInputRules() {
    return [
      // >>> for toggle
      wrappingInputRule({
        find: /^>>>\s$/,
        type: this.type,
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-t': () => this.editor.commands.toggleToggle(),
    }
  },
})

export default Toggle
