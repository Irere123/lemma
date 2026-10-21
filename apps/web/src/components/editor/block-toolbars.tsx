import { useEditor, useEditorState } from '@lemma/headless'
import type { Editor } from '@tiptap/core'
import { NodeSelection, PluginKey } from '@tiptap/pm/state'
import { CellSelection } from '@tiptap/pm/tables'
import { BubbleMenu } from '@tiptap/react/menus'
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Captions,
  Columns3,
  Rows3,
  Sheet,
  Trash2,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'

import { cn } from '@/lib/utils'
import { Tooltip, TooltipPopup, TooltipTrigger } from '../ui/tooltip'

type MenuEditor = Parameters<typeof BubbleMenu>[0]['editor']
type ShouldShow = Parameters<typeof BubbleMenu>[0]['shouldShow']

// Module-level (stable) options: see EditorBubble in @lemma/headless.
const IMAGE_KEY = new PluginKey('imageToolbar')
const IMAGE_OPTIONS = { placement: 'top', offset: 8, shift: { padding: 8 } } as const
const TABLE_KEY = new PluginKey('tableToolbar')
const TABLE_OPTIONS = {
  placement: 'top-start',
  offset: 8,
  shift: { padding: 8 },
  flip: {},
} as const

/** Is the selection inside a figure (an image or table with a caption)? */
const inFigure = (editor: Editor) => {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === 'figure') return true
  }
  // A selected image directly in a figure.
  return editor.state.doc.resolve(editor.state.selection.from).parent.type.name === 'figure'
}

type FigureChain = ReturnType<Editor['chain']> & {
  wrapInFigure: () => ReturnType<Editor['chain']>
  unwrapFigure: () => ReturnType<Editor['chain']>
}

/** Add a numbered caption (wrap in a figure) or take it away. */
function toggleCaption(editor: Editor) {
  const chain = editor.chain().focus() as FigureChain
  if (inFigure(editor)) {
    chain.unwrapFigure().run()
    return
  }
  chain.wrapInFigure().run()
  // Put the caret in the new caption.
  const { state } = editor
  const { $from } = state.selection
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name !== 'figure') continue
    const start = $from.before(depth)
    editor.commands.setTextSelection(start + node.nodeSize - 2)
    return
  }
  const after = state.doc.resolve(state.selection.from).nodeAfter
  if (after?.type.name === 'figure')
    editor.commands.setTextSelection(state.selection.from + after.nodeSize - 2)
}

const BAR =
  'flex items-center gap-0.5 rounded-lg border border-border/80 bg-popover p-1 text-sm shadow-lg'

function ToolButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type='button'
            aria-label={label}
            aria-pressed={active}
            onClick={onClick}
            className={cn(
              'flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-4',
              active && 'bg-accent text-foreground'
            )}
          >
            {children}
          </button>
        }
      />
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  )
}

// --- images ---------------------------------------------------------------

const selectedImage = (editor: Editor) => {
  const { selection } = editor.state
  return selection instanceof NodeSelection && selection.node.type.name === 'image'
    ? selection.node
    : null
}

const showImage = (({ editor }: { editor: Editor }) =>
  editor.isEditable && selectedImage(editor) !== null) as unknown as ShouldShow

// Widths in CSS pixels; "Full" clears the width so the image fills the column.
const SIZES = [
  { label: 'Small', width: 280 },
  { label: 'Medium', width: 440 },
  { label: 'Full width', width: null },
] as const

/** A selected image: size, alt text (for screen readers and SEO), delete. */
export function ImageToolbar() {
  const { editor } = useEditor()
  const image = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const node = e ? selectedImage(e) : null
      return node
        ? { width: node.attrs.width as number | null, alt: (node.attrs.alt as string | null) ?? '' }
        : null
    },
  })
  const [editingAlt, setEditingAlt] = useState(false)
  const [alt, setAlt] = useState('')

  useEffect(() => {
    if (!image) setEditingAlt(false)
  }, [image])

  if (!editor) return null

  const setWidth = (width: number | null) =>
    editor.chain().focus().updateAttributes('image', { width, height: null }).run()

  return (
    <BubbleMenu
      editor={editor as unknown as MenuEditor}
      pluginKey={IMAGE_KEY}
      shouldShow={showImage}
      options={IMAGE_OPTIONS}
      className={BAR}
    >
      {editingAlt ? (
        <form
          className='flex items-center gap-1'
          onSubmit={(event) => {
            event.preventDefault()
            editor
              .chain()
              .focus()
              .updateAttributes('image', { alt: alt.trim() || null })
              .run()
            setEditingAlt(false)
          }}
        >
          <input
            // biome-ignore lint/a11y/noAutofocus: opened on request to type the alt text
            autoFocus
            aria-label='Alt text'
            placeholder='Describe the image for people who can’t see it'
            value={alt}
            onChange={(event) => setAlt(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setEditingAlt(false)
                editor.commands.focus()
              }
            }}
            className='h-7 w-72 rounded-md border border-border/70 bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'
          />
          <button type='submit' className='h-7 rounded-md px-2 font-medium hover:bg-accent'>
            Save
          </button>
        </form>
      ) : (
        <>
          {SIZES.map((size) => (
            <ToolButton
              key={size.label}
              label={size.label}
              active={(image?.width ?? null) === size.width}
              onClick={() => setWidth(size.width)}
            >
              <span className='text-xs'>
                {size.label === 'Full width' ? 'Full' : size.label[0]}
              </span>
            </ToolButton>
          ))}
          <span aria-hidden='true' className='mx-0.5 h-5 w-px bg-border' />
          <ToolButton
            label={image?.alt ? `Alt text: ${image.alt}` : 'Add alt text'}
            active={Boolean(image?.alt)}
            onClick={() => {
              setAlt(image?.alt ?? '')
              setEditingAlt(true)
            }}
          >
            <span className='text-xs'>Alt</span>
          </ToolButton>
          <ToolButton
            label={
              inFigure(editor as unknown as Editor)
                ? 'Remove caption'
                : 'Add a caption (numbered figure)'
            }
            active={inFigure(editor as unknown as Editor)}
            onClick={() => toggleCaption(editor as unknown as Editor)}
          >
            <Captions />
          </ToolButton>
          <ToolButton
            label='Delete image'
            onClick={() => editor.chain().focus().deleteSelection().run()}
          >
            <Trash2 />
          </ToolButton>
        </>
      )}
    </BubbleMenu>
  )
}

// --- tables ---------------------------------------------------------------

const inTable = (editor: Editor) => {
  const { selection } = editor.state
  return (selection.empty || selection instanceof CellSelection) && editor.isActive('table')
}

const showTable = (({ editor }: { editor: Editor }) =>
  editor.isEditable && inTable(editor)) as unknown as ShouldShow

// Anchor the bar to the table, not the caret, so it doesn't jump while typing.
function tableRect(editor: Editor) {
  return () => {
    const { view, state } = editor
    const dom = view.domAtPos(state.selection.from).node
    const element = dom instanceof Element ? dom : dom.parentElement
    const table = element?.closest('table')
    return table?.getBoundingClientRect() ?? new DOMRect()
  }
}

/** Caret in a table: rows, columns, header, delete. */
export function TableToolbar() {
  const { editor } = useEditor()
  // Stable identity, like the options (see EditorBubble in @lemma/headless).
  const getReferencedVirtualElement = useCallback(
    () => (editor ? { getBoundingClientRect: tableRect(editor as unknown as Editor) } : null),
    [editor]
  )
  if (!editor) return null
  const run =
    (command: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () =>
      command(editor.chain().focus() as unknown as ReturnType<Editor['chain']>).run()

  return (
    <BubbleMenu
      editor={editor as unknown as MenuEditor}
      pluginKey={TABLE_KEY}
      shouldShow={showTable}
      options={TABLE_OPTIONS}
      getReferencedVirtualElement={getReferencedVirtualElement}
      className={BAR}
    >
      <ToolButton label='Insert row above' onClick={run((c) => c.addRowBefore())}>
        <ArrowUpToLine />
      </ToolButton>
      <ToolButton label='Insert row below' onClick={run((c) => c.addRowAfter())}>
        <ArrowDownToLine />
      </ToolButton>
      <ToolButton label='Insert column left' onClick={run((c) => c.addColumnBefore())}>
        <ArrowLeftToLine />
      </ToolButton>
      <ToolButton label='Insert column right' onClick={run((c) => c.addColumnAfter())}>
        <ArrowRightToLine />
      </ToolButton>
      <span aria-hidden='true' className='mx-0.5 h-5 w-px bg-border' />
      <ToolButton label='Delete row' onClick={run((c) => c.deleteRow())}>
        <Rows3 />
      </ToolButton>
      <ToolButton label='Delete column' onClick={run((c) => c.deleteColumn())}>
        <Columns3 />
      </ToolButton>
      <ToolButton label='Header row on / off' onClick={run((c) => c.toggleHeaderRow())}>
        <Sheet />
      </ToolButton>
      <ToolButton
        label={
          inFigure(editor as unknown as Editor)
            ? 'Remove caption'
            : 'Add a caption (numbered table)'
        }
        active={inFigure(editor as unknown as Editor)}
        onClick={() => toggleCaption(editor as unknown as Editor)}
      >
        <Captions />
      </ToolButton>
      <span aria-hidden='true' className='mx-0.5 h-5 w-px bg-border' />
      <ToolButton label='Delete table' onClick={run((c) => c.deleteTable())}>
        <Trash2 />
      </ToolButton>
    </BubbleMenu>
  )
}
