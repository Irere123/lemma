import { Command, createSuggestionItems, renderItems } from '@lemma/headless'
import type { Editor } from '@tiptap/core'
import {
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  ImageIcon,
  Lightbulb,
  List,
  ListOrdered,
  MessageSquarePlus,
  Minus,
  Radical,
  Sigma,
  Superscript,
  Table as TableIcon,
  Text,
  TextQuote,
} from 'lucide-react'

import { pickImages } from './image-upload'
import type { MathEdit } from './math-dialog'

// Commands declared by @lemma/content's extensions (callout, math, footnotes,
// tables) aren't on the slash-menu editor type; re-type through @tiptap/core.
const chain = (editor: unknown) => (editor as unknown as Editor).chain().focus()

// Remove the typed "/query", then open the equation editor where it was.
// Nothing is inserted until the writer saves.
const newEquation = (editor: unknown, range: { from: number; to: number }, display: boolean) => {
  chain(editor).deleteRange(range).run()
  const storage = (editor as Editor).storage as unknown as {
    mathEditing?: { open: (edit: MathEdit) => void }
  }
  storage.mathEditing?.open({ latex: '', pos: range.from, display, isNew: true })
}

export const suggestionItems = createSuggestionItems([
  {
    title: 'Text',
    group: 'Basic',
    description: 'Plain paragraph text.',
    searchTerms: ['p', 'paragraph'],
    icon: <Text size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleNode('paragraph', 'paragraph').run()
    },
  },
  {
    title: 'Heading 1',
    group: 'Basic',
    shortcut: '#',
    description: 'Big section heading.',
    searchTerms: ['title', 'big', 'large'],
    icon: <Heading1 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
  },
  {
    title: 'Heading 2',
    group: 'Basic',
    shortcut: '##',
    description: 'Medium section heading.',
    searchTerms: ['subtitle', 'medium'],
    icon: <Heading2 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
  },
  {
    title: 'Heading 3',
    group: 'Basic',
    shortcut: '###',
    description: 'Small section heading.',
    searchTerms: ['subtitle', 'small'],
    icon: <Heading3 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
  },
  {
    title: 'Heading 4',
    group: 'Basic',
    shortcut: '####',
    description: 'Sub-section heading.',
    searchTerms: ['subheading', 'h4', 'minor'],
    icon: <Heading4 size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 4 }).run()
    },
  },
  {
    title: 'Bulleted list',
    group: 'Lists',
    shortcut: '-',
    description: 'A simple bulleted list.',
    searchTerms: ['unordered', 'point'],
    icon: <List size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Numbered list',
    group: 'Lists',
    shortcut: '1.',
    description: 'A list with numbers.',
    searchTerms: ['ordered'],
    icon: <ListOrdered size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: 'To-do list',
    group: 'Lists',
    shortcut: '[]',
    description: 'Tasks you can tick off.',
    searchTerms: ['todo', 'task', 'list', 'check', 'checkbox'],
    icon: <CheckSquare size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
  },
  {
    title: 'Quote',
    group: 'Basic',
    shortcut: '>',
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
    title: 'Callout',
    group: 'Basic',
    description: 'A note set apart in a box.',
    searchTerms: ['note', 'info', 'warning', 'tip', 'aside'],
    icon: <Lightbulb size={18} />,
    command: ({ editor, range }) => {
      chain(editor).deleteRange(range).setCallout().run()
    },
  },
  {
    title: 'Code block',
    group: 'Media and data',
    shortcut: '```',
    description: 'Code with syntax highlighting.',
    searchTerms: ['codeblock'],
    icon: <Code size={18} />,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Table',
    group: 'Media and data',
    description: 'Insert a 3×3 table.',
    searchTerms: ['grid', 'rows', 'columns'],
    icon: <TableIcon size={18} />,
    command: ({ editor, range }) => {
      chain(editor).deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    },
  },
  {
    title: 'Image',
    group: 'Media and data',
    description: 'Upload an image from your computer.',
    searchTerms: ['photo', 'picture', 'media', 'upload', 'figure'],
    icon: <ImageIcon size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      pickImages(editor.view)
    },
  },
  {
    title: 'Equation',
    group: 'Math and notes',
    shortcut: '$$$',
    description: 'A display equation in LaTeX.',
    searchTerms: ['math', 'latex', 'formula', 'tex', 'katex', 'block'],
    icon: <Sigma size={18} />,
    command: ({ editor, range }) => {
      newEquation(editor, range, true)
    },
  },
  {
    title: 'Inline equation',
    group: 'Math and notes',
    shortcut: '$$',
    description: 'Math inside a sentence.',
    searchTerms: ['math', 'latex', 'formula', 'inline'],
    icon: <Radical size={18} />,
    command: ({ editor, range }) => {
      newEquation(editor, range, false)
    },
  },
  {
    title: 'Footnote',
    group: 'Math and notes',
    description: 'A numbered note at the end.',
    searchTerms: ['note', 'citation', 'reference', 'endnote', 'footnote'],
    icon: <Superscript size={18} />,
    command: ({ editor, range }) => {
      chain(editor).deleteRange(range).insertFootnote().run()
    },
  },
  {
    title: 'Divider',
    group: 'Basic',
    shortcut: '---',
    description: 'A horizontal line between sections.',
    searchTerms: ['hr', 'line', 'separator', 'rule'],
    icon: <Minus size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
  {
    title: 'Send feedback',
    group: 'Help',
    description: 'Let us know how we can improve.',
    searchTerms: ['feedback', 'help', 'support'],
    icon: <MessageSquarePlus size={18} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      window.open('/feedback', '_blank')
    },
  },
])

export const slashCommand = Command.configure({
  suggestion: {
    items: () => suggestionItems,
    render: renderItems,
  },
})
