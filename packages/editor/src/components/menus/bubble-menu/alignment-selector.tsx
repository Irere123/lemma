import type { Editor } from '@tiptap/core'
import type { LucideIcon } from 'lucide-react'
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'
// components
import { TextAlignItem } from '@/components/menus'
import { cn } from '@/lib'
// types
import type { TEditorCommands } from '@/types'
import type { EditorStateType } from './root'

type Props = {
  editor: Editor
  editorState: EditorStateType
}

export function TextAlignmentSelector(props: Props) {
  const { editor, editorState } = props
  const menuItem = TextAlignItem(editor)

  const textAlignmentOptions: {
    itemKey: TEditorCommands
    renderKey: string
    icon: LucideIcon
    command: () => void
    isActive: () => boolean
  }[] = [
    {
      itemKey: 'text-align',
      renderKey: 'text-align-left',
      icon: AlignLeft,
      command: () =>
        menuItem.command({
          alignment: 'left',
        }),
      isActive: () => editorState.left,
    },
    {
      itemKey: 'text-align',
      renderKey: 'text-align-center',
      icon: AlignCenter,
      command: () =>
        menuItem.command({
          alignment: 'center',
        }),
      isActive: () => editorState.center,
    },
    {
      itemKey: 'text-align',
      renderKey: 'text-align-right',
      icon: AlignRight,
      command: () =>
        menuItem.command({
          alignment: 'right',
        }),
      isActive: () => editorState.right,
    },
  ]
  if (editorState.code) return null

  return (
    <div className='flex gap-0.5 px-2'>
      {textAlignmentOptions.map((item) => (
        <button
          key={item.renderKey}
          type='button'
          onClick={(e) => {
            e.stopPropagation()
            item.command()
          }}
          className={cn(
            'size-7 grid place-items-center rounded-sm text-muted-foreground hover:bg-muted active:bg-muted transition-colors',
            {
              'bg-muted text-foreground': item.isActive(),
            }
          )}
        >
          <item.icon className='size-4' />
        </button>
      ))}
    </div>
  )
}
