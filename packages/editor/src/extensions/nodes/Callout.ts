import { mergeAttributes, Node, wrappingInputRule } from '@tiptap/core'

import type { CalloutVariant } from '../../types'

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>
  variants: CalloutVariant[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: { variant?: CalloutVariant }) => ReturnType
      toggleCallout: (attributes?: { variant?: CalloutVariant }) => ReturnType
      setCalloutVariant: (variant: CalloutVariant) => ReturnType
    }
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',

  content: 'block+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      variants: ['info', 'warning', 'success', 'error', 'tip', 'note'],
    }
  },

  addAttributes() {
    return {
      variant: {
        default: 'info',
        parseHTML: (element) => element.getAttribute('data-variant') || 'info',
        renderHTML: (attributes) => ({
          'data-variant': attributes.variant,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'callout',
        class: `callout callout-${HTMLAttributes['data-variant'] || 'info'}`,
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attributes)
        },
      toggleCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attributes)
        },
      setCalloutVariant:
        (variant) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { variant })
        },
    }
  },

  addInputRules() {
    return [
      // >! for info callout
      wrappingInputRule({
        find: /^>!\s$/,
        type: this.type,
        getAttributes: () => ({ variant: 'info' }),
      }),
      // >? for tip callout
      wrappingInputRule({
        find: /^>\?\s$/,
        type: this.type,
        getAttributes: () => ({ variant: 'tip' }),
      }),
      // >x for error callout
      wrappingInputRule({
        find: /^>x\s$/,
        type: this.type,
        getAttributes: () => ({ variant: 'error' }),
      }),
      // >* for warning callout
      wrappingInputRule({
        find: /^>\*\s$/,
        type: this.type,
        getAttributes: () => ({ variant: 'warning' }),
      }),
      // >+ for success callout
      wrappingInputRule({
        find: /^>\+\s$/,
        type: this.type,
        getAttributes: () => ({ variant: 'success' }),
      }),
    ]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => this.editor.commands.toggleCallout(),
    }
  },
})

export default Callout
