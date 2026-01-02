// extensions

import { findTable, getSelectedRows } from '@/extensions/table/table/utilities/helpers'
import type { Editor } from '@tiptap/core'
import { TableMap } from '@tiptap/pm/tables'
import type { LucideIcon } from 'lucide-react'
import { ArrowDown, ArrowUp, CopyIcon, ToggleRight, Trash2Icon, XIcon } from 'lucide-react'
// local imports
import { duplicateRows } from '../actions'
import { TableDragHandleDropdownColorSelector } from '../color-selector'

const DROPDOWN_ITEMS: {
  key: string
  label: string
  icon: LucideIcon
  action: (editor: Editor) => void
}[] = [
  {
    key: 'insert-above',
    label: 'Insert above',
    icon: ArrowUp,
    action: (editor) => editor.chain().focus().addRowBefore().run(),
  },
  {
    key: 'insert-below',
    label: 'Insert below',
    icon: ArrowDown,
    action: (editor) => editor.chain().focus().addRowAfter().run(),
  },
  {
    key: 'duplicate',
    label: 'Duplicate',
    icon: CopyIcon,
    action: (editor) => {
      const table = findTable(editor.state.selection)
      if (!table) return

      const tableMap = TableMap.get(table.node)
      let tr = editor.state.tr
      const selectedRows = getSelectedRows(editor.state.selection, tableMap)
      tr = duplicateRows(table, selectedRows, tr)
      editor.view.dispatch(tr)
    },
  },
  {
    key: 'clear-contents',
    label: 'Clear contents',
    icon: XIcon,
    action: (editor) => editor.chain().focus().clearSelectedCells().run(),
  },
  {
    key: 'delete',
    label: 'Delete',
    icon: Trash2Icon,
    action: (editor) => editor.chain().focus().deleteRow().run(),
  },
]

type Props = {
  editor: Editor
  onClose: () => void
}

export function RowOptionsDropdown(props: Props) {
  const { editor, onClose } = props

  return (
    <>
      <button
        type='button'
        className='flex items-center justify-between gap-2 w-full rounded-sm px-1 py-1.5 text-xs text-left truncate text-muted-foreground hover:bg-muted'
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          editor.chain().focus().toggleHeaderRow().run()
          onClose()
        }}
      >
        <div className='flex-grow truncate'>Header row</div>
        <ToggleRight className='shrink-0 size-3' />
      </button>
      <hr className='my-2 border-border/50' />
      <TableDragHandleDropdownColorSelector editor={editor} onSelect={onClose} />
      {DROPDOWN_ITEMS.map((item) => (
        <button
          key={item.key}
          type='button'
          className='flex items-center gap-2 w-full rounded-sm px-1 py-1.5 text-11 text-left truncate text-secondary hover:bg-layer-1'
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            item.action(editor)
            onClose()
          }}
        >
          <item.icon className='shrink-0 size-3' />
          <div className='flex-grow truncate'>{item.label}</div>
        </button>
      ))}
    </>
  )
}
