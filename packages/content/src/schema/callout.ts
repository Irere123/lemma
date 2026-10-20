import { mergeAttributes, Node } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { emoji?: string }) => ReturnType
      toggleCallout: (attrs?: { emoji?: string }) => ReturnType
    }
  }
}

// Emoji is stored as data-emoji; the editor shows it via CSS, the renderer as .callout-icon.
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: '💡',
        parseHTML: (element) =>
          element.getAttribute('data-emoji') ||
          element.querySelector(':scope > .callout-icon')?.textContent?.trim() ||
          '💡',
        renderHTML: (attributes) => ({ 'data-emoji': attributes.emoji as string }),
      },
    }
  },

  parseHTML() {
    // Published output wraps the body: <div class="callout"><span class="callout-icon">…</span><div class="callout-body">…</div></div>
    const contentElement = (element: HTMLElement) =>
      element.querySelector<HTMLElement>(':scope > .callout-body') ?? element
    return [
      { tag: 'div[data-callout]', contentElement },
      { tag: 'div.callout', contentElement },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'callout', 'data-callout': '' }), 0]
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs),
      toggleCallout:
        (attrs) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, attrs),
    }
  },
})
