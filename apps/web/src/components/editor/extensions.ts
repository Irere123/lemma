import { contentExtensions, MathBlock, MathInline, PasteCleanup } from '@lemma/content/schema'
import { BODY_FIELD } from '@lemma/content/yjs'
import { ReactNodeViewRenderer, UploadImagesPlugin } from '@lemma/headless'
import type { Editor } from '@tiptap/core'
import { type AnyExtension, Extension, InputRule, mergeAttributes } from '@tiptap/core'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Collaboration } from '@tiptap/extension-collaboration'
import { ListKeymap } from '@tiptap/extension-list'
import { Dropcursor, Gapcursor } from '@tiptap/extensions'
import type { Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { common, createLowlight } from 'lowlight'
import type * as Y from 'yjs'

import { CalloutView, CodeBlockView } from './block-views'
import { type DocLinkOptions, DocLinkSuggestion } from './doc-link-suggestion'
import { Find } from './find'
import type { MathEdit } from './math-dialog'
import { MoveBlock } from './move-block'
import { Research, type ResearchStorage } from './research'
import { bibliographyView } from './research-views'
import { slashCommand } from './slash-command'
import { Typewriter } from './typewriter'

/**
 * Placeholder on the empty block holding the caret (and on an empty document).
 * Tiptap's Placeholder walks the whole document on every keystroke; this looks
 * only at the selection, so it costs the same for a note and a book.
 */
const CaretPlaceholder = Extension.create({
  name: 'caretPlaceholder',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('caretPlaceholder'),
        props: {
          decorations(state) {
            if (!editor.isEditable) return null
            const { $anchor, empty } = state.selection
            const decorations: Decoration[] = []
            const first = state.doc.firstChild
            if (state.doc.childCount === 1 && first?.isTextblock && first.content.size === 0) {
              decorations.push(
                Decoration.node(0, first.nodeSize, {
                  class: 'is-empty is-editor-empty',
                  'data-placeholder': 'Start writing, or press / for blocks',
                })
              )
            } else if (empty && $anchor.parent.isTextblock && $anchor.parent.content.size === 0) {
              const parent: PMNode = $anchor.parent
              const pos = $anchor.before()
              const text =
                parent.type.name === 'heading'
                  ? `Heading ${parent.attrs.level}`
                  : "Press '/' for commands"
              decorations.push(
                Decoration.node(pos, pos + parent.nodeSize, {
                  class: 'is-empty',
                  'data-placeholder': text,
                })
              )
            }
            return decorations.length > 0 ? DecorationSet.create(state.doc, decorations) : null
          },
        },
      }),
    ]
  },
})

/**
 * Marks the top-level block holding the caret. Off-screen blocks skip layout
 * (content-visibility: auto, see app.css), but Chromium also skips a block
 * created a moment ago, and a key typed within that first frame leaves the
 * caret before the character it inserted. The marked block always lays out.
 */
const ActiveBlock = Extension.create({
  name: 'activeBlock',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('activeBlock'),
        props: {
          decorations(state) {
            const { $head } = state.selection
            if ($head.depth === 0) return null
            const start = $head.before(1)
            const block = state.doc.child($head.index(0))
            return DecorationSet.create(state.doc, [
              Decoration.node(start, start + block.nodeSize, { class: 'is-active-block' }),
            ])
          },
        },
      }),
    ]
  },
})

/**
 * Opens the equation editor: from the slash menu (a new equation), on click,
 * or with Enter on a selected equation, so math can be edited without a mouse.
 */
const MathEditing = Extension.create<{ onEditMath: (edit: MathEdit) => void }>({
  name: 'mathEditing',
  addOptions() {
    return { onEditMath: () => {} }
  },
  addStorage() {
    return { open: (edit: MathEdit) => this.options.onEditMath(edit) }
  },
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state
        if (!(selection instanceof NodeSelection)) return false
        const { node, from } = selection
        if (node.type.name !== 'inlineMath' && node.type.name !== 'blockMath') return false
        this.options.onEditMath({
          latex: node.attrs.latex,
          pos: from,
          display: node.type.name === 'blockMath',
        })
        return true
      },
    }
  },
})

/**
 * ⌘K / Ctrl+K: link the selection, or edit the link the caret is in.
 */
const LinkShortcut = Extension.create<{ onOpenLink: () => void }>({
  name: 'linkShortcut',
  addOptions() {
    return { onOpenLink: () => {} }
  },
  addKeyboardShortcuts() {
    return {
      'Mod-k': ({ editor }) => {
        if (editor.state.selection.empty) {
          if (!editor.isActive('link')) return false
          editor.chain().extendMarkRange('link').run()
        }
        this.options.onOpenLink()
        return true
      },
    }
  },
})

/**
 * Typing "[@" opens the citation picker where it was typed (Pandoc's
 * citation syntax, familiar to academic writers).
 */
const CiteTrigger = Extension.create<{ onCite: (pos: number) => void }>({
  name: 'citeTrigger',
  addOptions() {
    return { onCite: () => {} }
  },
  addInputRules() {
    return [
      new InputRule({
        find: /\[@$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).run()
          this.options.onCite(range.from)
        },
      }),
    ]
  },
})

/** Editor-wide shortcuts that open React UI: find, go to, focus mode. */
const WorkspaceShortcuts = Extension.create<{
  onFind: () => void
  onGoTo: () => void
  onFocusMode: () => void
}>({
  name: 'workspaceShortcuts',
  addOptions() {
    return { onFind: () => {}, onGoTo: () => {}, onFocusMode: () => {} }
  },
  addKeyboardShortcuts() {
    return {
      'Mod-f': () => {
        this.options.onFind()
        return true
      },
      'Mod-p': () => {
        this.options.onGoTo()
        return true
      },
      'Mod-Shift-f': () => {
        this.options.onFocusMode()
        return true
      },
    }
  },
})

export type EditorExtensionOptions = {
  doc: Y.Doc
  /** Shared with the title and subtitle (see createUndoManager). */
  undoManager: Y.UndoManager
  onEditMath: (edit: MathEdit) => void
  /** ⌘K: open the link field for the selection. */
  onOpenLink?: () => void
  onDroppedImages?: (count: number) => void
  /** Open a cited source's picker (insert at pos), or edit the citation at pos. */
  onOpenCitation: (pos: number, editing: boolean) => void
  onOpenCrossReference: (pos: number) => void
  onOpenDocument: (id: string, blockId: string | null) => void
  onFind: () => void
  onGoTo: () => void
  onFocusMode: () => void
  linkDocuments: DocLinkOptions
}

const lowlight = createLowlight(common)

/**
 * The editor = the shared document model (@lemma/content/schema) plus
 * editor-only behaviour. Overrides keep each node's name and schema, so the
 * document the editor produces is exactly what the server validates.
 */
export function createEditorExtensions(options: EditorExtensionOptions): AnyExtension[] {
  const sharedImage = contentExtensions.find((extension) => extension.name === 'image')
  const sharedCallout = contentExtensions.find((extension) => extension.name === 'callout')
  const sharedBibliography = contentExtensions.find(
    (extension) => extension.name === 'bibliography'
  )
  const sharedDocumentLink = contentExtensions.find(
    (extension) => extension.name === 'documentLink'
  )

  const overrides: Record<string, AnyExtension | undefined> = {
    codeBlock: CodeBlockLowlight.extend({
      addNodeView() {
        return ReactNodeViewRenderer(CodeBlockView)
      },
    }).configure({ lowlight }),
    callout: sharedCallout?.extend({
      addNodeView() {
        return ReactNodeViewRenderer(CalloutView)
      },
    }),
    image: sharedImage?.extend({
      addProseMirrorPlugins() {
        return [UploadImagesPlugin({ imageClass: 'image-uploading' })]
      },
    }),
    inlineMath: MathInline.configure({
      katexOptions: { throwOnError: false },
      onClick: (node, pos) => options.onEditMath({ latex: node.attrs.latex, pos, display: false }),
    }),
    blockMath: MathBlock.configure({
      katexOptions: { throwOnError: false, displayMode: true },
      onClick: (node, pos) =>
        options.onEditMath({
          latex: node.attrs.latex,
          pos,
          display: true,
          numbered: node.attrs.numbered === true,
        }),
    }),
    bibliography: sharedBibliography?.extend({
      addNodeView() {
        return ({ node, editor }: { node: PMNode; editor: Editor }) =>
          bibliographyView((editor.storage as unknown as { research: ResearchStorage }).research)({
            node,
          })
      },
    }),
    // The label (the target's current title) is a decoration; no stored text in the DOM.
    documentLink: sharedDocumentLink?.extend({
      renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
        return ['a', mergeAttributes(HTMLAttributes, { 'data-document-link': '' })]
      },
    }),
  }

  return [
    ...contentExtensions.map((extension) => overrides[extension.name] ?? extension),
    // No remote carets: they recompute every caret position on each keystroke,
    // a cost that grows with the document, for a feature a single writer
    // switching tabs doesn't need.
    Collaboration.configure({
      document: options.doc,
      field: BODY_FIELD,
      yUndoOptions: { undoManager: options.undoManager },
    }),
    // Source-specific clipboard cleanup (Docs, Word, Notion, arXiv…) and Markdown paste.
    PasteCleanup.configure({ onDroppedImages: options.onDroppedImages }),
    Dropcursor.configure({ color: 'var(--primary)', width: 2 }),
    Gapcursor,
    ListKeymap,
    CaretPlaceholder,
    ActiveBlock,
    MathEditing.configure({ onEditMath: options.onEditMath }),
    MoveBlock,
    LinkShortcut.configure({ onOpenLink: options.onOpenLink ?? (() => {}) }),
    slashCommand,
    Research.configure({
      onOpenDocument: options.onOpenDocument,
      onEditCitation: (pos) => options.onOpenCitation(pos, true),
    }).extend({
      // Slash commands reach the pickers through the extension's storage.
      onCreate() {
        const storage = this.storage as ResearchStorage & {
          openCitation?: (pos: number) => void
          openCrossReference?: (pos: number) => void
        }
        storage.openCitation = (pos) => options.onOpenCitation(pos, false)
        storage.openCrossReference = options.onOpenCrossReference
      },
    }),
    CiteTrigger.configure({ onCite: (pos) => options.onOpenCitation(pos, false) }),
    DocLinkSuggestion.configure(options.linkDocuments),
    Find,
    Typewriter,
    WorkspaceShortcuts.configure({
      onFind: options.onFind,
      onGoTo: options.onGoTo,
      onFocusMode: options.onFocusMode,
    }),
  ]
}
