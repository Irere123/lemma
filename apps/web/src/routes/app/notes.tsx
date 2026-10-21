import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { NotebookPen, Plus, Search, Sun, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { EmptyState, ListSkeleton, Page, PageHeader } from '@/components/workspace/page'
import { useQuickCapture } from '@/components/workspace/quick-capture'
import { useCreate } from '@/hooks/use-create'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { relativeTime } from '@/lib/format'
import { isMac } from '@/lib/keys'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/app/notes')({
  component: Notes,
})

const HIGHLIGHT = /\u0002([^\u0003]*)\u0003/g

function Highlighted({ text }: { text: string }) {
  const parts = text.split(HIGHLIGHT)
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={`${index}-${part}`}
            className='rounded-[3px] bg-brand-soft px-0.5 text-foreground'
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}

function Notes() {
  const trpc = useTRPC()
  const create = useCreate()
  const openCapture = useQuickCapture((state) => state.setOpen)
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query.trim(), 200)

  const notes = useInfiniteQuery(
    trpc.documents.getUserDocuments.infiniteQueryOptions(
      { kinds: ['note'], limit: 100 },
      { getNextPageParam: (page) => page.nextCursor ?? undefined }
    )
  )
  // Full-text search finds words anywhere in a note; the list filter (below)
  // answers instantly from what's loaded, including notes written seconds ago.
  const search = useQuery({
    ...trpc.documents.searchDocuments.queryOptions({ query: debounced, limit: 30 }),
    enabled: debounced.length > 1,
    placeholderData: keepPreviousData,
  })

  const all = useMemo(() => notes.data?.pages.flatMap((page) => page.documents) ?? [], [notes.data])
  const needle = query.trim().toLowerCase()
  const local = needle
    ? all.filter((note) =>
        `${note.title ?? ''} ${note.excerpt ?? ''}`.toLowerCase().includes(needle)
      )
    : all
  const localIds = new Set(local.map((note) => note.id))
  const fromSearch = needle
    ? (search.data ?? []).filter((hit) => hit.kind === 'note' && !localIds.has(hit.id))
    : []
  const mod = isMac() ? '⌘' : 'Ctrl'
  const alt = isMac() ? '⌥' : 'Alt'

  return (
    <Page>
      <PageHeader
        title='Notes'
        description='Private by default. Link notes with [[ and see what links back.'
        actions={
          <>
            <Button variant='outline' onClick={create.openToday}>
              <Sun /> Today
            </Button>
            <Button onClick={create.createNote} disabled={create.isPending}>
              <Plus /> New note
            </Button>
          </>
        }
      />

      <div className='mb-5 flex flex-wrap items-center gap-3'>
        <div className='relative flex-1'>
          <Search className='-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 text-muted-foreground' />
          <Input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder='Search notes'
            aria-label='Search notes'
            className='pl-8'
          />
        </div>
        <button
          type='button'
          onClick={() => openCapture(true)}
          className='inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:h-8'
        >
          <Zap className='size-3.5' />
          Quick note
          {/* ⌥⌘N on a Mac, Ctrl+Alt+N elsewhere. */}
          <KbdGroup>
            <Kbd>{isMac() ? alt : mod}</Kbd>
            <Kbd>{isMac() ? mod : alt}</Kbd>
            <Kbd>N</Kbd>
          </KbdGroup>
        </button>
      </div>

      {notes.isLoading ? (
        <ListSkeleton />
      ) : all.length === 0 && !needle ? (
        <EmptyState
          icon={<NotebookPen />}
          title='No notes yet'
          description='Capture ideas, reading notes and meetings. A note can grow into a post when it’s ready.'
          action={
            <Button onClick={create.createNote}>
              <Plus /> Write a note
            </Button>
          }
        />
      ) : (
        <ul className='flex flex-col divide-y divide-border/60'>
          {local.map((note) => (
            <li key={note.id}>
              <Link
                to='/write/$docId'
                params={{ docId: note.id }}
                className='-mx-3 flex items-baseline gap-4 rounded-lg px-3 py-3 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring'
              >
                <span className='min-w-0 flex-1'>
                  <span className='flex items-center gap-2'>
                    {note.journalDate ? (
                      <Sun className='size-3.5 shrink-0 text-warning' aria-label='Daily note' />
                    ) : null}
                    <span className='truncate font-medium text-[15px] text-foreground'>
                      {note.title?.trim() || 'Untitled note'}
                    </span>
                  </span>
                  {note.excerpt ? (
                    <span className='mt-0.5 block line-clamp-1 text-[13.5px] text-muted-foreground'>
                      {note.excerpt}
                    </span>
                  ) : null}
                </span>
                <span className='shrink-0 text-[12.5px] text-muted-foreground'>
                  {relativeTime(note.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
          {fromSearch.map((hit) => (
            <li key={hit.id}>
              <Link
                to='/write/$docId'
                params={{ docId: hit.id }}
                className='-mx-3 block rounded-lg px-3 py-3 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring'
              >
                <span className='block truncate font-medium text-[15px] text-foreground'>
                  <Highlighted text={hit.titleHighlighted ?? hit.title ?? 'Untitled note'} />
                </span>
                {hit.snippet ? (
                  <span className='mt-0.5 block line-clamp-2 text-[13.5px] text-muted-foreground'>
                    <Highlighted text={hit.snippet} />
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
          {needle && local.length === 0 && fromSearch.length === 0 && !search.isFetching ? (
            <li className='py-10 text-center text-[14px] text-muted-foreground'>
              No notes match “{query}”.
            </li>
          ) : null}
        </ul>
      )}
      {notes.hasNextPage && !needle ? (
        <div className='mt-6 flex justify-center'>
          <Button
            variant='outline'
            onClick={() => notes.fetchNextPage()}
            disabled={notes.isFetchingNextPage}
          >
            Show more
          </Button>
        </div>
      ) : null}
    </Page>
  )
}
