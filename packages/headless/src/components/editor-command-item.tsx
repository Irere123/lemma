import type { Editor, Range } from '@tiptap/core'
import { useCurrentEditor } from '@tiptap/react'
import { CommandEmpty, CommandItem } from 'cmdk'
import { useAtomValue } from 'jotai'
import type { ComponentPropsWithoutRef, ForwardRefExoticComponent, RefAttributes } from 'react'
import { forwardRef, type ReactElement } from 'react'
import { rangeAtom } from '../utils/atoms'

interface EditorCommandItemProps {
  readonly onCommand: ({ editor, range }: { editor: Editor; range: Range }) => void
}

export const EditorCommandItem: ForwardRefExoticComponent<
  EditorCommandItemProps &
    ComponentPropsWithoutRef<typeof CommandItem> &
    RefAttributes<HTMLDivElement>
> = forwardRef<
  HTMLDivElement,
  EditorCommandItemProps & ComponentPropsWithoutRef<typeof CommandItem>
>(function EditorCommandItemInner({ children, onCommand, ...rest }, ref): ReactElement | null {
  const { editor } = useCurrentEditor()
  const range = useAtomValue(rangeAtom)

  if (!editor || !range) return null

  return (
    <CommandItem ref={ref} {...rest} onSelect={() => onCommand({ editor, range })}>
      {children}
    </CommandItem>
  )
})

EditorCommandItem.displayName = 'EditorCommandItem'

export const EditorCommandEmpty: typeof CommandEmpty = CommandEmpty

export default EditorCommandItem
