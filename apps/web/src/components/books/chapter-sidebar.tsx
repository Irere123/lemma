import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus, X } from 'lucide-react'

import { Progress } from '@/components/workspace/progress'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useTRPC } from '@/trpc/client'

export type OutlineHeading = { id: string; label: string; level: number; pos: number }

/**
 * Beside a chapter: the book's chapters (jump to any), the book's progress,
 * and this chapter's headings (jump within it).
 */
export function ChapterSidebar({
  bookId,
  currentId,
  headings,
  onJump,
  onClose,
}: {
  bookId: string
  currentId: string
  headings: OutlineHeading[]
  onJump: (pos: number) => void
  onClose: () => void
}) {
  const trpc = useTRPC()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useQuery(trpc.books.get.queryOptions({ bookId }))
  const add = useMutation(
    trpc.books.addEntry.mutationOptions({
      onSuccess: (entry) => {
        void queryClient.invalidateQueries({ queryKey: trpc.books.get.queryKey({ bookId }) })
        void navigate({ to: '/write/$docId', params: { docId: entry.id } })
      },
    })
  )
  const entries = data?.entries ?? []
  const words = entries
    .filter((entry) => entry.kind === 'chapter')
    .reduce((sum, entry) => sum + (Number(entry.wordCount) || 0), 0)
  const target = data?.book.wordTarget ?? null
  let number = 0

  return (
    <aside
      aria-label='Book'
      className='chapter-sidebar fixed top-13 bottom-0 left-0 z-30 w-72 flex-col border-border/60 border-r bg-canvas/95 backdrop-blur-md'
    >
      <div className='flex items-start justify-between gap-2 px-4 pt-4 pb-3'>
        <div className='min-w-0'>
          <Link
            to='/app/books/$bookId'
            params={{ bookId }}
            className='block truncate font-semibold text-[14.5px] text-foreground hover:underline'
          >
            {data?.book.title || 'Book'}
          </Link>
          <p className='mt-0.5 text-[12px] text-muted-foreground tabular-nums'>
            {formatNumber(words)} words
          </p>
        </div>
        <button
          type='button'
          aria-label='Close sidebar'
          onClick={onClose}
          className='rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
        >
          <X className='size-4' />
        </button>
      </div>
      {target ? (
        <Progress value={words / target} className='px-4 pb-3' label='Book progress' />
      ) : null}
      <nav className='min-h-0 flex-1 overflow-y-auto px-2 pb-4' aria-label='Chapters'>
        <ol className='flex flex-col gap-px'>
          {entries.map((entry) => {
            if (entry.kind === 'part') {
              return (
                <li
                  key={entry.id}
                  className='mt-3 mb-0.5 px-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.08em]'
                >
                  {entry.title || 'Part'}
                </li>
              )
            }
            number++
            const active = entry.id === currentId
            return (
              <li key={entry.id}>
                <Link
                  to='/write/$docId'
                  params={{ docId: entry.id }}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-baseline gap-2 rounded-md px-2 py-1.5 text-[13.5px] outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'bg-accent font-medium text-foreground' : 'text-foreground/80'
                  )}
                >
                  <span className='w-5 shrink-0 text-right font-serif text-[12.5px] text-muted-foreground tabular-nums'>
                    {number}
                  </span>
                  <span className='min-w-0 flex-1 truncate'>
                    {entry.title || 'Untitled chapter'}
                  </span>
                </Link>
                {active && headings.length > 0 ? (
                  <ol className='mt-0.5 mb-1 ml-7 flex flex-col border-border border-l'>
                    {headings.map((heading) => (
                      <li key={heading.id}>
                        <button
                          type='button'
                          onClick={() => onJump(heading.pos)}
                          className='block w-full truncate py-1 pr-2 text-left text-[12.5px] text-muted-foreground hover:text-foreground'
                          style={{
                            paddingLeft: `${0.75 + Math.max(0, heading.level - 2) * 0.75}rem`,
                          }}
                        >
                          {heading.label}
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </li>
            )
          })}
        </ol>
        <button
          type='button'
          onClick={() => add.mutate({ bookId, kind: 'chapter', afterId: currentId })}
          disabled={add.isPending}
          className='mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground'
        >
          <Plus className='size-3.5' /> New chapter after this one
        </button>
      </nav>
    </aside>
  )
}
