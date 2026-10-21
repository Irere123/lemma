import { stripBlockIds } from '@lemma/content/schema'
// The editor context lives in @lemma/headless's copy of @tiptap/react.
import { useEditor } from '@lemma/headless'
import type { Editor, JSONContent } from '@tiptap/core'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  CheckSquare,
  Code,
  Copy,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  Plus,
  Repeat2,
  Scissors,
  Text,
  TextQuote,
  Trash2,
} from 'lucide-react'
import { type ReactNode, useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from '../ui/menu'
import { moveBlock } from './move-block'

type Target = { node: PMNode | null; pos: number }

const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')

// Position of the first place text can go inside the node at `pos`.
function caretInside(editor: Editor, pos: number): number | null {
  const node = editor.state.doc.nodeAt(pos)
  if (!node) return null
  if (node.isTextblock) return pos + 1
  let found: number | null = null
  node.descendants((child, offset) => {
    if (found !== null) return false
    if (child.isTextblock) {
      found = pos + 1 + offset + 1
      return false
    }
    return true
  })
  return found
}

type AnyChain = ReturnType<Editor['chain']>
// Commands from @lemma/content's extensions (callout) aren't on the base chain type.
const withCallout = (chain: AnyChain) =>
  (chain as unknown as { setCallout: () => AnyChain }).setCallout()

const TURN_INTO: { label: string; icon: ReactNode; run: (chain: AnyChain) => AnyChain }[] = [
  { label: 'Text', icon: <Text />, run: (c) => c.setParagraph() },
  { label: 'Heading 1', icon: <Heading1 />, run: (c) => c.setHeading({ level: 1 }) },
  { label: 'Heading 2', icon: <Heading2 />, run: (c) => c.setHeading({ level: 2 }) },
  { label: 'Heading 3', icon: <Heading3 />, run: (c) => c.setHeading({ level: 3 }) },
  { label: 'Bulleted list', icon: <List />, run: (c) => c.toggleBulletList() },
  { label: 'Numbered list', icon: <ListOrdered />, run: (c) => c.toggleOrderedList() },
  { label: 'To-do list', icon: <CheckSquare />, run: (c) => c.toggleTaskList() },
  { label: 'Quote', icon: <TextQuote />, run: (c) => c.toggleBlockquote() },
  { label: 'Callout', icon: <Lightbulb />, run: withCallout },
  { label: 'Code block', icon: <Code />, run: (c) => c.toggleCodeBlock() },
]

/**
 * Notion-style controls beside the block under the pointer: + adds a block
 * below (⌥-click: above) and opens the block menu; ⋮⋮ drags the block, or
 * on click opens its actions. Hidden while typing and on touch screens; the
 * keyboard has ⌘⇧↑/↓ and the slash menu.
 */
/** In a chapter: split the chapter at a block, or move a block to another chapter. */
export type ChapterTools = {
  chapters: { id: string; title: string | null }[]
  onSplit: (blockId: string) => void
  onMove: (blockId: string, chapterId: string) => void
}

export function BlockHandle({
  blockUrl,
  chapterTools,
}: {
  blockUrl: (id: string) => string
  chapterTools?: ChapterTools | null
}) {
  const { editor } = useEditor()
  const target = useRef<Target>({ node: null, pos: -1 })
  const [menuOpen, setMenuOpen] = useState(false)

  const onNodeChange = useCallback(({ node, pos }: Target) => {
    target.current = { node, pos }
  }, [])

  const setLocked = useCallback(
    (locked: boolean) => {
      editor?.commands.setMeta('lockDragHandle', locked)
    },
    [editor]
  )

  const onMenuOpenChange = useCallback(
    (open: boolean) => {
      setMenuOpen(open)
      setLocked(open)
    },
    [setLocked]
  )

  if (!editor) return null

  const current = () => {
    const { node, pos } = target.current
    return node && pos >= 0 && editor.state.doc.nodeAt(pos) ? { node, pos } : null
  }

  const addBlock = (above: boolean) => {
    const block = current()
    if (!block) return
    const { node, pos } = block
    // An empty paragraph is already the place to type.
    if (node.type.name === 'paragraph' && node.content.size === 0) {
      editor
        .chain()
        .focus()
        .setTextSelection(pos + 1)
        .insertContent('/')
        .run()
      return
    }
    const at = above ? pos : pos + node.nodeSize
    editor
      .chain()
      .focus()
      .insertContentAt(at, { type: 'paragraph', content: [{ type: 'text', text: '/' }] })
      .setTextSelection(at + 2)
      .run()
  }

  const turnInto = (run: (chain: AnyChain) => AnyChain) => {
    const block = current()
    const caret = block ? caretInside(editor, block.pos) : null
    if (caret === null) return
    run(editor.chain().focus().setTextSelection(caret)).run()
  }

  const duplicate = () => {
    const block = current()
    if (!block) return
    // A copy is a new block: drop the ids so it gets its own.
    const copy = stripBlockIds(block.node.toJSON() as JSONContent)
    editor
      .chain()
      .focus()
      .insertContentAt(block.pos + block.node.nodeSize, copy)
      .run()
  }

  const copyLink = async () => {
    const id = current()?.node.attrs.id
    if (typeof id !== 'string') return
    try {
      await navigator.clipboard.writeText(blockUrl(id))
      toast.success('Link to block copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  const move = (direction: -1 | 1) => {
    const block = current()
    const caret = block ? caretInside(editor, block.pos) : null
    if (caret === null) return
    const { state } = editor
    const tr = moveBlock(
      state.apply(state.tr.setSelection(TextSelection.create(state.doc, caret))),
      direction
    )
    if (tr) editor.view.dispatch(tr)
    editor.commands.focus()
  }

  const remove = () => {
    const block = current()
    if (!block) return
    editor
      .chain()
      .focus()
      .deleteRange({ from: block.pos, to: block.pos + block.node.nodeSize })
      .run()
  }

  const node = target.current.node
  const canTurnInto = node ? caretInside(editor, target.current.pos) !== null : false
  const mod = isMac() ? '⌘' : 'Ctrl+'

  return (
    <DragHandle editor={editor} onNodeChange={onNodeChange} nested className='block-handle'>
      <div className='flex items-center pe-1.5'>
        <button
          type='button'
          className='block-handle-button'
          aria-label='Add a block below (Alt: above)'
          title='Add a block below · ⌥-click to add above'
          onClick={(event) => addBlock(event.altKey)}
        >
          <Plus />
        </button>
        <Menu open={menuOpen} onOpenChange={onMenuOpenChange}>
          <MenuTrigger
            render={
              <button
                type='button'
                className='block-handle-button cursor-grab active:cursor-grabbing'
                aria-label='Drag to move, click for block actions'
                title='Drag to move · click for actions'
              >
                <GripVertical />
              </button>
            }
          />
          <MenuPopup side='left' align='start' className='min-w-56'>
            <MenuSub>
              <MenuSubTrigger disabled={!canTurnInto}>
                <Repeat2 />
                Turn into
              </MenuSubTrigger>
              <MenuSubPopup className='min-w-48'>
                {TURN_INTO.map((item) => (
                  <MenuItem key={item.label} onClick={() => turnInto(item.run)}>
                    {item.icon}
                    {item.label}
                  </MenuItem>
                ))}
              </MenuSubPopup>
            </MenuSub>
            <MenuItem onClick={duplicate}>
              <Copy />
              Duplicate
            </MenuItem>
            <MenuItem onClick={() => void copyLink()} disabled={typeof node?.attrs.id !== 'string'}>
              <Link2 />
              Copy link to block
            </MenuItem>
            {chapterTools && typeof node?.attrs.id === 'string' ? (
              <>
                <MenuSeparator />
                <MenuItem onClick={() => chapterTools.onSplit(node.attrs.id as string)}>
                  <Scissors />
                  Split chapter here
                </MenuItem>
                {chapterTools.chapters.length > 0 ? (
                  <MenuSub>
                    <MenuSubTrigger>
                      <ArrowRightLeft />
                      Move to chapter
                    </MenuSubTrigger>
                    <MenuSubPopup className='max-h-80 min-w-56 overflow-y-auto'>
                      {chapterTools.chapters.map((chapter) => (
                        <MenuItem
                          key={chapter.id}
                          onClick={() => chapterTools.onMove(node.attrs.id as string, chapter.id)}
                        >
                          {chapter.title || 'Untitled chapter'}
                        </MenuItem>
                      ))}
                    </MenuSubPopup>
                  </MenuSub>
                ) : null}
              </>
            ) : null}
            <MenuSeparator />
            <MenuItem onClick={() => move(-1)}>
              <ArrowUp />
              Move up
              <MenuShortcut className='text-muted-foreground opacity-100'>{mod}⇧↑</MenuShortcut>
            </MenuItem>
            <MenuItem onClick={() => move(1)}>
              <ArrowDown />
              Move down
              <MenuShortcut className='text-muted-foreground opacity-100'>{mod}⇧↓</MenuShortcut>
            </MenuItem>
            <MenuSeparator />
            <MenuItem variant='destructive' onClick={remove}>
              <Trash2 />
              Delete
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
    </DragHandle>
  )
}
