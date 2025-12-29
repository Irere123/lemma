import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

import { SlashMenuExtension } from '../components/menus/SlashMenu'
import { Callout } from './nodes/Callout'
import { EnhancedCodeBlock } from './nodes/EnhancedCodeBlock'
import { ImageBlock } from './nodes/ImageBlock'
import { TableExtensions } from './nodes/TableExtension'
import { Toggle } from './nodes/Toggle'

export interface ExtensionOptions {
  placeholder?: string
  onNoteLinkClick?: (noteId: string, noteTitle: string) => void
}

export function createExtensions(options: ExtensionOptions = {}) {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      codeBlock: false, // We use EnhancedCodeBlock instead
      dropcursor: {
        color: 'var(--editor-dropcursor-color, #3b82f6)',
        width: 2,
      },
    }),

    // Task lists
    TaskList,
    TaskItem.configure({
      nested: true,
    }),

    // Enhanced code block with syntax highlighting and UI
    EnhancedCodeBlock,

    // Table support
    ...TableExtensions,

    // Typography for elegant writing (smart quotes, dashes, etc.)
    Typography,

    // Inline marks
    Underline,
    Highlight.configure({
      multicolor: true,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: {
        rel: 'noopener noreferrer nofollow',
      },
    }),

    // Basic image extension (for inline images, used alongside ImageBlock)
    Image.configure({
      inline: true,
      allowBase64: true,
    }),

    // Custom extensions
    Callout,
    Toggle,
    ImageBlock,

    // Placeholder with dynamic text based on node type
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') {
          const level = node.attrs.level
          if (level === 1) return 'Heading 1'
          if (level === 2) return 'Heading 2'
          if (level === 3) return 'Heading 3'
        }
        return options.placeholder || "Start writing, or press '/' for commands..."
      },
      emptyEditorClass: 'is-editor-empty',
      emptyNodeClass: 'is-empty',
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
      includeChildren: true,
    }),

    // Markdown support for import/export
    Markdown.configure({
      html: true,
      tightLists: true,
      tightListClass: 'tight',
      bulletListMarker: '-',
      linkify: true,
      breaks: false,
      transformPastedText: true,
      transformCopiedText: true,
    }),

    // Slash menu for block commands
    SlashMenuExtension,
  ]
}

export type { CalloutOptions, ImageBlockOptions, ToggleOptions } from './nodes'
// Re-export individual extensions for customization
export { Callout, ImageBlock, Toggle } from './nodes'
