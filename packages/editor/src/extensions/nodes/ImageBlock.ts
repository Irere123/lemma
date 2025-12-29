import { mergeAttributes, Node, nodeInputRule } from '@tiptap/core'

export interface ImageBlockOptions {
  inline: boolean
  allowBase64: boolean
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageBlock: {
      setImageBlock: (options: {
        src: string
        alt?: string
        title?: string
        width?: number
        alignment?: 'left' | 'center' | 'right'
      }) => ReturnType
      setImageAlignment: (alignment: 'left' | 'center' | 'right') => ReturnType
      setImageWidth: (width: number) => ReturnType
    }
  }
}

export const inputRegex = /(?:^|\s)(!\[(.+|:?)]\((\S+)(?:(?:\s+)["'](\S+)["'])?\))$/

export const ImageBlock = Node.create<ImageBlockOptions>({
  name: 'imageBlock',

  group: 'block',

  draggable: true,

  addOptions() {
    return {
      inline: false,
      allowBase64: false,
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.querySelector('img')?.getAttribute('src'),
        renderHTML: (attributes) => ({
          src: attributes.src,
        }),
      },
      alt: {
        default: null,
        parseHTML: (element) => element.querySelector('img')?.getAttribute('alt'),
        renderHTML: (attributes) => ({
          alt: attributes.alt,
        }),
      },
      title: {
        default: null,
        parseHTML: (element) => element.querySelector('img')?.getAttribute('title'),
        renderHTML: (attributes) => ({
          title: attributes.title,
        }),
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.querySelector('img')?.getAttribute('width')
          return width ? Number.parseInt(width, 10) : null
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {}
          return { width: attributes.width }
        },
      },
      alignment: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-alignment') || 'center',
        renderHTML: (attributes) => ({
          'data-alignment': attributes.alignment,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="image-block"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { src, alt, title, width, alignment, ...rest } = HTMLAttributes

    return [
      'figure',
      mergeAttributes(this.options.HTMLAttributes, rest, {
        'data-type': 'image-block',
        'data-alignment': alignment || 'center',
        class: `image-block image-block-${alignment || 'center'}`,
      }),
      [
        'img',
        {
          src,
          alt,
          title,
          ...(width ? { width } : {}),
        },
      ],
      ['figcaption', {}, title || ''],
    ]
  },

  addCommands() {
    return {
      setImageBlock:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
      setImageAlignment:
        (alignment) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { alignment })
        },
      setImageWidth:
        (width) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { width })
        },
    }
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => {
          const [, , alt, src, title] = match
          return { src, alt, title }
        },
      }),
    ]
  },
})

export default ImageBlock
