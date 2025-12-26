import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { common, createLowlight } from 'lowlight'

import { Callout } from './nodes/Callout'
import { ImageBlock } from './nodes/ImageBlock'
import { Toggle } from './nodes/Toggle'
import { NoteLink } from './marks/NoteLink'
import { SlashMenuExtension } from '../components/menus/SlashMenu'

// Create lowlight instance with common languages
const lowlight = createLowlight(common)

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
      codeBlock: false, // We use CodeBlockLowlight instead
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

    // Code block with syntax highlighting
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: 'plaintext',
    }),

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
    NoteLink.configure({
      onNoteLinkClick: options.onNoteLinkClick,
    }),

    // Placeholder
    Placeholder.configure({
      placeholder: options.placeholder || "Start writing, or press '/' for commands...",
      emptyEditorClass: 'is-editor-empty',
      emptyNodeClass: 'is-empty',
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
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

// Re-export individual extensions for customization
export { Callout, Toggle, ImageBlock } from './nodes'
export { NoteLink } from './marks'
export type { CalloutOptions, ToggleOptions, ImageBlockOptions } from './nodes'
export type { NoteLinkOptions } from './marks'
