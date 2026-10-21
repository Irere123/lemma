import { Link } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Target,
  Trash2,
} from 'lucide-react'
import { type DragEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { StatusPill } from '@/components/workspace/page'
import { ProgressRing } from '@/components/workspace/progress'
import { formatNumber, relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'

export type OutlineEntry = {
  id: string
  title: string | null
  kind: string
  status: string | null
  wordCount: string | null
  wordTarget: number | null
  updatedAt: Date | string | null
}

type Props = {
  entries: OutlineEntry[]
  onReorder: (ids: string[]) => void
  onRename: (id: string, title: string) => void
  onAdd: (kind: 'chapter' | 'part', afterId: string | null) => void
  onDelete: (entry: OutlineEntry) => void
  onSetTarget: (entry: OutlineEntry) => void
}

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

/**
 * A book's chapters and parts in reading order. Reorder by dragging a row,
 * or with ⌥↑/⌥↓ on a focused row (also in each row's menu). Reordering only
 * changes positions, so it can never lose text.
 */
export function BookOutline({ entries, onReorder, onRename, onAdd, onDelete, onSetTarget }: Props) {
  const [order, setOrder] = useState(entries)
  const [dragging, setDragging] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const rows = useRef(new Map<string, HTMLElement>())

  useEffect(() => setOrder(entries), [entries])

  const commit = (next: OutlineEntry[], moved?: OutlineEntry) => {
    setOrder(next)
    onReorder(next.map((entry) => entry.id))
    if (moved) {
      const index = next.indexOf(moved)
      setAnnouncement(
        `${moved.title || 'Untitled'} moved to position ${index + 1} of ${next.length}`
      )
    }
  }

  const shift = (id: string, by: -1 | 1) => {
    const index = order.findIndex((entry) => entry.id === id)
    const target = index + by
    if (index === -1 || target < 0 || target >= order.length) return
    const moved = order[index]
    commit(move(order, index, target), moved)
    requestAnimationFrame(() => rows.current.get(id)?.focus())
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, id: string) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    shift(id, event.key === 'ArrowUp' ? -1 : 1)
  }

  const onDragOver = (event: DragEvent<HTMLElement>, id: string) => {
    if (!dragging || dragging === id) return
    event.preventDefault()
    const box = event.currentTarget.getBoundingClientRect()
    setDrop({ id, after: event.clientY > box.top + box.height / 2 })
  }

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    if (!dragging || !drop) return
    const from = order.findIndex((entry) => entry.id === dragging)
    const moved = order[from]
    const without = order.filter((entry) => entry.id !== dragging)
    const at = without.findIndex((entry) => entry.id === drop.id) + (drop.after ? 1 : 0)
    if (moved) {
      without.splice(at, 0, moved)
      commit(without, moved)
    }
    setDragging(null)
    setDrop(null)
  }

  let chapterNumber = 0
  return (
    <div>
      <p className='sr-only' aria-live='polite'>
        {announcement}
      </p>
      <ol
        className='flex flex-col'
        onDragEnd={() => {
          setDragging(null)
          setDrop(null)
        }}
      >
        {order.map((entry, index) => {
          const isPart = entry.kind === 'part'
          if (!isPart) chapterNumber++
          const words = Number(entry.wordCount) || 0
          const indicator =
            drop?.id === entry.id ? (drop.after ? 'after:opacity-100' : 'before:opacity-100') : ''
          return (
            <li
              key={entry.id}
              aria-label={`${isPart ? 'Part' : `Chapter ${chapterNumber}`}: ${entry.title || 'Untitled'}`}
              draggable={renaming !== entry.id}
              onDragStart={(event) => {
                setDragging(entry.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', entry.id)
              }}
              onDragOver={(event) => onDragOver(event, entry.id)}
              onDrop={onDrop}
              className={cn(
                'group/entry relative flex items-center gap-2 rounded-lg',
                // The drop line, above or below the row it would land beside.
                'before:-top-px after:-bottom-px before:pointer-events-none after:pointer-events-none before:absolute after:absolute before:inset-x-2 after:inset-x-2 before:h-0.5 after:h-0.5 before:rounded-full after:rounded-full before:bg-brand after:bg-brand before:opacity-0 after:opacity-0',
                indicator,
                isPart ? 'mt-5 mb-1 first:mt-0' : 'hover:bg-accent/50',
                dragging === entry.id && 'opacity-40'
              )}
            >
              <button
                type='button'
                ref={(element) => {
                  if (element) rows.current.set(entry.id, element)
                  else rows.current.delete(entry.id)
                }}
                aria-label={`Move ${entry.title || 'Untitled'} (Alt+↑ or Alt+↓)`}
                onKeyDown={(event) => onKeyDown(event, entry.id)}
                className='flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/50 opacity-0 outline-none transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover/entry:opacity-100 active:cursor-grabbing'
              >
                <GripVertical className='size-4' />
              </button>
              {isPart ? (
                <div className='flex min-w-0 flex-1 items-baseline gap-3 border-border border-b py-2'>
                  <span className='font-medium text-[11px] text-muted-foreground uppercase tracking-[0.1em]'>
                    Part
                  </span>
                  {renaming === entry.id ? (
                    <RenameField
                      value={entry.title ?? ''}
                      onDone={(title) => {
                        setRenaming(null)
                        if (title !== null) onRename(entry.id, title)
                      }}
                      className='font-semibold text-[15px]'
                    />
                  ) : (
                    <button
                      type='button'
                      onDoubleClick={() => setRenaming(entry.id)}
                      className='truncate text-left font-semibold text-[15px] text-foreground'
                    >
                      {entry.title || 'Untitled part'}
                    </button>
                  )}
                </div>
              ) : (
                <div className='flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-1'>
                  <span className='w-6 shrink-0 text-right font-serif text-[14px] text-muted-foreground tabular-nums'>
                    {chapterNumber}
                  </span>
                  {renaming === entry.id ? (
                    <RenameField
                      value={entry.title ?? ''}
                      onDone={(title) => {
                        setRenaming(null)
                        if (title !== null) onRename(entry.id, title)
                      }}
                      className='text-[15px]'
                    />
                  ) : (
                    <Link
                      to='/write/$docId'
                      params={{ docId: entry.id }}
                      draggable={false}
                      className='min-w-0 flex-1 truncate text-[15px] text-foreground outline-none hover:underline focus-visible:underline'
                    >
                      {entry.title || 'Untitled chapter'}
                    </Link>
                  )}
                  <span className='hidden shrink-0 items-center gap-1.5 text-[12.5px] text-muted-foreground tabular-nums sm:flex'>
                    {entry.wordTarget ? (
                      <span
                        title={`${formatNumber(words)} of ${formatNumber(entry.wordTarget)} words`}
                      >
                        <ProgressRing value={words / entry.wordTarget} size={15} />
                      </span>
                    ) : null}
                    <span className='w-20 text-right'>{formatNumber(words)} words</span>
                  </span>
                  <span className='hidden w-24 shrink-0 justify-end md:flex'>
                    <StatusPill status={entry.status} />
                  </span>
                  <span className='hidden w-20 shrink-0 text-right text-[12px] text-muted-foreground lg:inline'>
                    {relativeTime(entry.updatedAt)}
                  </span>
                </div>
              )}
              <div className='flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover/entry:opacity-100'>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  aria-label={`Add a chapter after ${entry.title || 'this'}`}
                  onClick={() => onAdd('chapter', entry.id)}
                >
                  <Plus />
                </Button>
                <Menu>
                  <MenuTrigger
                    render={
                      <Button
                        variant='ghost'
                        size='icon-xs'
                        aria-label={`Actions for ${entry.title || 'Untitled'}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    }
                  />
                  <MenuPopup align='end' className='min-w-48'>
                    {!isPart ? (
                      <MenuItem render={<Link to='/write/$docId' params={{ docId: entry.id }} />}>
                        <NotebookPen /> Open
                      </MenuItem>
                    ) : null}
                    <MenuItem onClick={() => setRenaming(entry.id)}>
                      <Pencil /> Rename
                    </MenuItem>
                    {!isPart ? (
                      <MenuItem onClick={() => onSetTarget(entry)}>
                        <Target /> Word target…
                      </MenuItem>
                    ) : null}
                    <MenuSeparator />
                    <MenuItem disabled={index === 0} onClick={() => shift(entry.id, -1)}>
                      <ArrowUp /> Move up
                    </MenuItem>
                    <MenuItem
                      disabled={index === order.length - 1}
                      onClick={() => shift(entry.id, 1)}
                    >
                      <ArrowDown /> Move down
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem variant='destructive' onClick={() => onDelete(entry)}>
                      <Trash2 /> Delete
                    </MenuItem>
                  </MenuPopup>
                </Menu>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function RenameField({
  value,
  onDone,
  className,
}: {
  value: string
  onDone: (title: string | null) => void
  className?: string
}) {
  const [text, setText] = useState(value)
  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: renaming starts typing at once
      autoFocus
      value={text}
      aria-label='Title'
      onChange={(event) => setText(event.currentTarget.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={() => onDone(text.trim())}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onDone(text.trim())
        if (event.key === 'Escape') onDone(null)
      }}
      className={cn(
        'min-w-0 flex-1 rounded-md bg-background px-1.5 py-0.5 text-foreground shadow-surface outline-none ring-2 ring-ring',
        className
      )}
    />
  )
}
