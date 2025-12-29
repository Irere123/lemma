import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'

// Configure Table extension with resizing and proper styling
export const LemmaTable = Table.configure({
  resizable: true,
  HTMLAttributes: {
    class: 'lemma-table',
  },
  lastColumnResizable: true,
  cellMinWidth: 100,
})

export const LemmaTableRow = TableRow.configure({
  HTMLAttributes: {
    class: 'lemma-table-row',
  },
})

export const LemmaTableCell = TableCell.configure({
  HTMLAttributes: {
    class: 'lemma-table-cell',
  },
})

export const LemmaTableHeader = TableHeader.configure({
  HTMLAttributes: {
    class: 'lemma-table-header',
  },
})

// Export all table extensions as an array for easy inclusion
export const TableExtensions = [LemmaTable, LemmaTableRow, LemmaTableCell, LemmaTableHeader]
