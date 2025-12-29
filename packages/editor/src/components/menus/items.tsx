import {
  IconAlertCircle,
  IconBlockquote,
  IconChevronRight,
  IconCode,
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListCheck,
  IconListNumbers,
  IconPhoto,
  IconPilcrow,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconSeparator,
  IconTable,
  IconTrash,
} from '@tabler/icons-react'
import type { Editor, Range } from '@tiptap/core'

export interface SlashMenuItem {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  keywords: string[]
  command: (props: { editor: Editor; range: Range }) => void
}

export const slashMenuItems: SlashMenuItem[] = [
  {
    id: 'paragraph',
    title: 'Text',
    description: 'Just start writing with plain text.',
    icon: <IconPilcrow size={18} />,
    keywords: ['text', 'paragraph', 'p'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run()
    },
  },
  {
    id: 'heading1',
    title: 'Heading 1',
    description: 'Big section heading.',
    icon: <IconH1 size={18} />,
    keywords: ['h1', 'heading', 'title', 'big'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
  },
  {
    id: 'heading2',
    title: 'Heading 2',
    description: 'Medium section heading.',
    icon: <IconH2 size={18} />,
    keywords: ['h2', 'heading', 'subtitle', 'medium'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
  },
  {
    id: 'heading3',
    title: 'Heading 3',
    description: 'Small section heading.',
    icon: <IconH3 size={18} />,
    keywords: ['h3', 'heading', 'small'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
  },
  {
    id: 'bulletList',
    title: 'Bullet List',
    description: 'Create a simple bulleted list.',
    icon: <IconList size={18} />,
    keywords: ['bullet', 'list', 'unordered', 'ul'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    id: 'orderedList',
    title: 'Numbered List',
    description: 'Create a list with numbering.',
    icon: <IconListNumbers size={18} />,
    keywords: ['numbered', 'list', 'ordered', 'ol'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    id: 'taskList',
    title: 'Task List',
    description: 'Track tasks with a to-do list.',
    icon: <IconListCheck size={18} />,
    keywords: ['task', 'todo', 'checkbox', 'check'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run()
    },
  },
  {
    id: 'table',
    title: 'Table',
    description: 'Add a table to organize data.',
    icon: <IconTable size={18} />,
    keywords: ['table', 'grid', 'spreadsheet', 'data'],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run()
    },
  },
  {
    id: 'blockquote',
    title: 'Quote',
    description: 'Capture a quote.',
    icon: <IconBlockquote size={18} />,
    keywords: ['quote', 'blockquote', 'citation'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    id: 'codeBlock',
    title: 'Code Block',
    description: 'Capture a code snippet with syntax highlighting.',
    icon: <IconCode size={18} />,
    keywords: ['code', 'codeblock', 'snippet', 'programming'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
  },
  {
    id: 'divider',
    title: 'Divider',
    description: 'Visually divide blocks.',
    icon: <IconSeparator size={18} />,
    keywords: ['divider', 'hr', 'separator', 'horizontal'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
  {
    id: 'callout',
    title: 'Callout',
    description: 'Add a highlighted callout box.',
    icon: <IconAlertCircle size={18} />,
    keywords: ['callout', 'alert', 'info', 'warning', 'note'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout({ variant: 'info' }).run()
    },
  },
  {
    id: 'toggle',
    title: 'Toggle',
    description: 'Collapsible content section.',
    icon: <IconChevronRight size={18} />,
    keywords: ['toggle', 'collapse', 'expand', 'accordion'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setToggle().run()
    },
  },
  {
    id: 'image',
    title: 'Image',
    description: 'Upload or embed an image.',
    icon: <IconPhoto size={18} />,
    keywords: ['image', 'picture', 'photo', 'media'],
    command: ({ editor, range }) => {
      // This will be handled by the parent component to trigger image upload
      editor.chain().focus().deleteRange(range).run()
      // Dispatch a custom event for image upload
      window.dispatchEvent(new CustomEvent('lemma-editor:upload-image'))
    },
  },
]

// Table-specific menu items (shown when inside a table)
export const tableMenuItems: SlashMenuItem[] = [
  {
    id: 'addRowBefore',
    title: 'Add Row Above',
    description: 'Insert a row above the current row.',
    icon: <IconRowInsertTop size={18} />,
    keywords: ['row', 'above', 'insert', 'before'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).addRowBefore().run()
    },
  },
  {
    id: 'addRowAfter',
    title: 'Add Row Below',
    description: 'Insert a row below the current row.',
    icon: <IconRowInsertBottom size={18} />,
    keywords: ['row', 'below', 'insert', 'after'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).addRowAfter().run()
    },
  },
  {
    id: 'addColumnBefore',
    title: 'Add Column Left',
    description: 'Insert a column to the left.',
    icon: <IconColumnInsertLeft size={18} />,
    keywords: ['column', 'left', 'insert', 'before'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).addColumnBefore().run()
    },
  },
  {
    id: 'addColumnAfter',
    title: 'Add Column Right',
    description: 'Insert a column to the right.',
    icon: <IconColumnInsertRight size={18} />,
    keywords: ['column', 'right', 'insert', 'after'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).addColumnAfter().run()
    },
  },
  {
    id: 'deleteTable',
    title: 'Delete Table',
    description: 'Remove the entire table.',
    icon: <IconTrash size={18} />,
    keywords: ['delete', 'remove', 'table'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).deleteTable().run()
    },
  },
]

export function filterSlashMenuItems(query: string): SlashMenuItem[] {
  if (!query) return slashMenuItems

  const lowercaseQuery = query.toLowerCase()
  return slashMenuItems.filter((item) => {
    return (
      item.title.toLowerCase().includes(lowercaseQuery) ||
      item.description.toLowerCase().includes(lowercaseQuery) ||
      item.keywords.some((keyword) => keyword.toLowerCase().includes(lowercaseQuery))
    )
  })
}
