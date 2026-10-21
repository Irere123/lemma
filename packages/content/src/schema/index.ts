import { type AnyExtension, getSchema, type JSONContent } from '@tiptap/core'
import CodeBlock from '@tiptap/extension-code-block'
import Document from '@tiptap/extension-document'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { TextStyle } from '@tiptap/extension-text-style'
import Youtube from '@tiptap/extension-youtube'
import type { Schema } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'

import { BlockIds } from './block-ids'
import { Callout } from './callout'
import { DocumentLink } from './document-link'
import { Footnote, FootnoteReference, Footnotes } from './footnotes'
import { InlineCode, TextColor, TextHighlight } from './marks'
import { MathBlock, MathInline } from './math'
import { Bibliography, Citation, CrossReference, Figcaption, Figure } from './research'
import { UnmarkedInlineNodes } from './unmarked'

export {
  BLOCK_ID_PATTERN,
  BLOCK_ID_TYPES,
  type BlockChanges,
  BlockIds,
  blockChanges,
  carryBlockIds,
  ensureYBlockIds,
  isBlockIdType,
  newBlockId,
  stripBlockIds,
} from './block-ids'
export { Callout } from './callout'
export { describeSchema, schemaFingerprint } from './contract'
export { DocumentLink } from './document-link'
export { Footnote, FootnoteReference, Footnotes, newFootnoteId, syncFootnotes } from './footnotes'
export { InlineCode, TextColor, TextHighlight } from './marks'
export { MathBlock, MathInline } from './math'
export {
  looksLikeMarkdown,
  markdownSlice,
  type NormalizedPaste,
  normalizePastedHTML,
  PasteCleanup,
  type PasteCleanupOptions,
} from './paste'
export {
  Bibliography,
  Citation,
  type CitationItem,
  type CitationMode,
  CrossReference,
  Figcaption,
  Figure,
} from './research'
export { UNMARKED_INLINE_TYPES, UnmarkedInlineNodes } from './unmarked'
export {
  ContentValidationError,
  normalizeContent,
  toPlainJSON,
  type ValidateOptions,
  validateContent,
} from './validate'

// Footnotes may only appear once, as the last block.
const ContentDocument = Document.extend({ content: 'block+ footnotes?' })

// Published embeds carry the original URL and start time on the wrapper, so a
// re-import restores the node exactly rather than the derived embed URL.
const ContentYoutube = Youtube.extend({
  parseHTML() {
    return [
      {
        tag: 'div[data-youtube-video][data-src]',
        priority: 1000,
        getAttrs: (node: HTMLElement | string) => {
          if (typeof node === 'string') return false
          const iframe = node.querySelector('iframe')
          return {
            src: node.getAttribute('data-src'),
            start: Number(node.getAttribute('data-start') ?? 0) || 0,
            width: Number(iframe?.getAttribute('width')) || 640,
            height: Number(iframe?.getAttribute('height')) || 480,
          }
        },
      },
      ...(this.parent?.() ?? []),
    ]
  },
})

// Tiptap reads attributes without a parseHTML through fromString, so an alt
// text of "2024" would come back as a number and "true" as a boolean. Text
// attributes stay strings, and an empty one is no value.
const textAttribute = (name: string) => ({
  default: null,
  parseHTML: (element: HTMLElement) => element.getAttribute(name) || null,
})

const ContentImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), alt: textAttribute('alt'), title: textAttribute('title') }
  },
})

const ContentLink = Link.extend({
  addAttributes() {
    return { ...this.parent?.(), title: textAttribute('title') }
  },
})

/**
 * THE document model: every node, mark and attribute a Lemma document can
 * store. The editor, the API (validation, Yjs conversion, markdown import) and
 * the parity tests all build their schema from this list, so they cannot drift.
 *
 * Only schema-defining extensions belong here. Editor-only behaviour (keymaps,
 * placeholders, drag handles, node views) is layered on in the web app by
 * extending or replacing entries with the same `name`.
 */
export const contentExtensions: AnyExtension[] = [
  ContentDocument,
  StarterKit.configure({
    document: false,
    code: false,
    codeBlock: false,
    link: false,
    dropcursor: false,
    gapcursor: false,
    undoRedo: false,
    trailingNode: false,
    listKeymap: false,
    heading: { levels: [1, 2, 3, 4, 5, 6] },
  }),
  InlineCode,
  CodeBlock,
  ContentLink.configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
    // Styling lives in CSS; never store presentational classes in the document.
    HTMLAttributes: { class: null },
  }),
  ContentImage.configure({ allowBase64: true }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TextStyle,
  TextColor,
  TextHighlight,
  Superscript,
  Subscript,
  ContentYoutube.configure({ inline: false }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  MathInline,
  MathBlock,
  Callout,
  FootnoteReference,
  Footnotes,
  Footnote,
  Figure,
  Figcaption,
  Citation,
  Bibliography,
  CrossReference,
  DocumentLink,
  BlockIds,
  UnmarkedInlineNodes,
]

let cachedSchema: Schema | null = null

export function getContentSchema(): Schema {
  if (!cachedSchema) cachedSchema = getSchema(contentExtensions)
  return cachedSchema
}

export type { JSONContent }
