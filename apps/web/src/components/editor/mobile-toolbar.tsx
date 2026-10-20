import { useEditor, useEditorState } from '@lemma/headless'
import type { Editor } from '@tiptap/core'
import {
  Bold,
  CheckSquare,
  ChevronDown,
  Heading2,
  ImageIcon,
  Italic,
  Link2,
  List,
  Plus,
  Redo2,
  Undo2,
} from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'

import { cn } from '@/lib/utils'
import { pickImages } from './image-upload'

function ToolbarButton({
  label,
  active = false,
  onPress,
  children,
}: {
  label: string
  active?: boolean
  onPress: () => void
  children: ReactNode
}) {
  return (
    <button
      type='button'
      aria-label={label}
      aria-pressed={active}
      // Keep the editor focused (and the keyboard open).
      onPointerDown={(event) => event.preventDefault()}
      onClick={onPress}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg text-foreground/80 active:bg-accent [&_svg]:size-5',
        active && 'bg-accent text-foreground'
      )}
    >
      {children}
    </button>
  )
}

const MARKS = ['bold', 'italic', 'link', 'heading', 'bulletList', 'taskList'] as const

/**
 * On touch screens, the formatting bar sits on top of the keyboard while the
 * body has focus (the floating selection menu is desktop-only).
 */
export function MobileToolbar({ onLink }: { onLink: () => void }) {
  const { editor } = useEditor()
  const [visible, setVisible] = useState(false)
  const [bottom, setBottom] = useState(0)

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      MARKS.map((name) => (current ? current.isActive(name) : false)).join(','),
  })
  const isActive = (name: (typeof MARKS)[number]) =>
    active?.split(',')[MARKS.indexOf(name)] === 'true'

  useEffect(() => {
    if (!editor || !window.matchMedia('(pointer: coarse)').matches) return
    const onFocus = () => setVisible(true)
    const onBlur = () => setVisible(false)
    // Follow the on-screen keyboard: the visual viewport shrinks above it.
    const viewport = window.visualViewport
    const place = () => {
      if (!viewport) return
      setBottom(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop))
    }
    editor.on('focus', onFocus)
    editor.on('blur', onBlur)
    viewport?.addEventListener('resize', place)
    viewport?.addEventListener('scroll', place)
    place()
    if (editor.isFocused) setVisible(true)
    return () => {
      editor.off('focus', onFocus)
      editor.off('blur', onBlur)
      viewport?.removeEventListener('resize', place)
      viewport?.removeEventListener('scroll', place)
    }
  }, [editor])

  if (!editor || !visible) return null
  const run = (command: (editor: Editor) => void) => () => command(editor as unknown as Editor)

  return (
    <div
      role='toolbar'
      aria-label='Formatting'
      className='fixed inset-x-0 z-50 border-border border-t bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur'
      style={{ bottom }}
    >
      <div className='flex items-center gap-0.5 overflow-x-auto py-1 [scrollbar-width:none]'>
        <ToolbarButton
          label='Insert a block'
          onPress={run((e) => e.chain().focus().insertContent('/').run())}
        >
          <Plus />
        </ToolbarButton>
        <ToolbarButton
          label='Heading'
          active={isActive('heading')}
          onPress={run((e) => e.chain().focus().toggleHeading({ level: 2 }).run())}
        >
          <Heading2 />
        </ToolbarButton>
        <ToolbarButton
          label='Bold'
          active={isActive('bold')}
          onPress={run((e) => e.chain().focus().toggleBold().run())}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label='Italic'
          active={isActive('italic')}
          onPress={run((e) => e.chain().focus().toggleItalic().run())}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton label='Link' active={isActive('link')} onPress={onLink}>
          <Link2 />
        </ToolbarButton>
        <ToolbarButton
          label='Bulleted list'
          active={isActive('bulletList')}
          onPress={run((e) => e.chain().focus().toggleBulletList().run())}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label='To-do list'
          active={isActive('taskList')}
          onPress={run((e) => e.chain().focus().toggleTaskList().run())}
        >
          <CheckSquare />
        </ToolbarButton>
        <ToolbarButton label='Image' onPress={run((e) => pickImages(e.view))}>
          <ImageIcon />
        </ToolbarButton>
        <span aria-hidden='true' className='mx-1 h-6 w-px shrink-0 bg-border' />
        <ToolbarButton label='Undo' onPress={run((e) => e.chain().focus().undo().run())}>
          <Undo2 />
        </ToolbarButton>
        <ToolbarButton label='Redo' onPress={run((e) => e.chain().focus().redo().run())}>
          <Redo2 />
        </ToolbarButton>
        <ToolbarButton label='Hide keyboard' onPress={run((e) => e.commands.blur())}>
          <ChevronDown />
        </ToolbarButton>
      </div>
    </div>
  )
}
