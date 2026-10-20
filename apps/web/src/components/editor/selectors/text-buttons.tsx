import { EditorBubbleItem, useEditor, useEditorState } from '@lemma/headless'
import type { Editor } from '@tiptap/core'
import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  type LucideIcon,
  StrikethroughIcon,
  SubscriptIcon,
  SuperscriptIcon,
  UnderlineIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type TextButton = {
  name: string
  label: string
  icon: LucideIcon
  command: (editor: Editor) => void
}

const buttons: TextButton[] = [
  {
    name: 'bold',
    label: 'Bold (⌘B)',
    icon: BoldIcon,
    command: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    name: 'italic',
    label: 'Italic (⌘I)',
    icon: ItalicIcon,
    command: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    name: 'underline',
    label: 'Underline (⌘U)',
    icon: UnderlineIcon,
    command: (e) => e.chain().focus().toggleUnderline().run(),
  },
  {
    name: 'strike',
    label: 'Strikethrough (⌘⇧S)',
    icon: StrikethroughIcon,
    command: (e) => e.chain().focus().toggleStrike().run(),
  },
  {
    name: 'code',
    label: 'Inline code (⌘E)',
    icon: CodeIcon,
    command: (e) => e.chain().focus().toggleCode().run(),
  },
  {
    name: 'superscript',
    label: 'Superscript (⌘.)',
    icon: SuperscriptIcon,
    command: (e) => e.chain().focus().toggleSuperscript().run(),
  },
  {
    name: 'subscript',
    label: 'Subscript (⌘,)',
    icon: SubscriptIcon,
    command: (e) => e.chain().focus().toggleSubscript().run(),
  },
]

export const TextButtons = () => {
  const { editor } = useEditor()
  // Re-renders only when the active marks change, not on every keystroke.
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      buttons.map((item) => (current ? current.isActive(item.name) : false)).join(','),
  })
  if (!editor) return null
  const isActive = (index: number) => active?.split(',')[index] === 'true'
  return (
    <div className='flex'>
      {buttons.map((item, index) => (
        <EditorBubbleItem
          key={item.name}
          onSelect={(current) => item.command(current as unknown as Editor)}
        >
          <Button
            size='sm'
            className='rounded-none'
            variant='ghost'
            type='button'
            aria-label={item.label}
            title={item.label}
          >
            <item.icon className={cn('h-4 w-4', isActive(index) && 'text-primary')} />
          </Button>
        </EditorBubbleItem>
      ))}
    </div>
  )
}
