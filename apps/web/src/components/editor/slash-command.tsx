import { Command, createSuggestionItems, renderItems } from '@lemma/headless'
import {
  Blocks,
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  List,
  ListOrdered,
  MessageSquarePlus,
  Text,
  TextQuote,
} from 'lucide-react'

import { createCustomBlockToken } from '@/lib/custom-blocks'

export const suggestionItems = createSuggestionItems([
  {
    title: 'Send Feedback',
    description: 'Let us know how we can improve.',
    icon: <MessageSquarePlus size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      window.open('/feedback', '_blank')
    },
  },
  {
    title: 'Text',
    description: 'Just start typing with plain text.',
    searchTerms: ['p', 'paragraph'],
    icon: <Text size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleNode('paragraph', 'paragraph').run()
    },
  },
  {
    title: 'To-do List',
    description: 'Track tasks with a to-do list.',
    searchTerms: ['todo', 'task', 'list', 'check', 'checkbox'],
    icon: <CheckSquare size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
  },
  {
    title: 'Heading 1',
    description: 'Big section heading.',
    searchTerms: ['title', 'big', 'large'],
    icon: <Heading1 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading.',
    searchTerms: ['subtitle', 'medium'],
    icon: <Heading2 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading.',
    searchTerms: ['subtitle', 'small'],
    icon: <Heading3 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list.',
    searchTerms: ['unordered', 'point'],
    icon: <List size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Numbered List',
    description: 'Create a list with numbering.',
    searchTerms: ['ordered'],
    icon: <ListOrdered size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: 'Quote',
    description: 'Capture a quote.',
    searchTerms: ['blockquote'],
    icon: <TextQuote size={18} />,
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleNode('paragraph', 'paragraph')
        .toggleBlockquote()
        .run(),
  },
  {
    title: 'Code',
    description: 'Capture a code snippet.',
    searchTerms: ['codeblock'],
    icon: <Code size={18} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Image',
    description: 'Insert an image from a URL.',
    searchTerms: ['photo', 'picture', 'media'],
    icon: <ImageIcon size={18} />,
    command: ({ editor, range }) => {
      const src = window.prompt('Enter image URL')
      if (!src) return

      editor.chain().focus().deleteRange(range).setImage({ src }).run()
    },
  },
  {
    title: 'Custom Block',
    description: 'Insert a markdown token for a future custom block.',
    searchTerms: ['block', 'embed', 'cta', 'button', 'substack'],
    icon: <Blocks size={18} />,
    command: ({ editor, range }) => {
      const type = window.prompt('Block type (button, embed, callout)', 'button')?.trim()
      if (!type) return

      const rawAttrs = window.prompt(
        'Block attributes JSON (optional)',
        type === 'button'
          ? '{"label":"Subscribe","url":"https://example.com"}'
          : '{"url":"https://example.com"}'
      )
      if (rawAttrs == null) return

      let attrs: Record<string, unknown> = {}
      if (rawAttrs.trim().length > 0) {
        try {
          attrs = JSON.parse(rawAttrs) as Record<string, unknown>
        } catch {
          window.alert('Invalid JSON. Block attributes were ignored.')
        }
      }

      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(`${createCustomBlockToken(type, attrs)}\n`)
        .run()
    },
  },
])

export const slashCommand = Command.configure({
  suggestion: {
    items: () => suggestionItems,
    render: renderItems,
  },
})
