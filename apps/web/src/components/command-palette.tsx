import {
  IconAlignJustified,
  IconCornerDownLeft,
  IconFileText,
  IconLoader2,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUserCircle,
} from '@tabler/icons-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Command } from 'cmdk'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

import { useCreateDocument } from '@/hooks/use-create-document'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'
import { useCommandPaletteStore } from '@/stores/command-palette'
import { useDocumentStore } from '@/stores/document-store'
import { useTRPC } from '@/trpc/client'

type CommandAction = {
  id: string
  label: string
  icon: ReactNode
  keywords: string[]
  run: () => void
}

const itemClassName =
  'flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-foreground text-sm outline-none transition-colors duration-75 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:size-4.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-[selected=true]:[&_svg]:text-accent-foreground'

const groupClassName =
  'overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:text-xs'

// The server wraps matched terms in these control characters (SQLite char(2)/
// char(3)). They never appear in real content, so splitting on them is safe —
// no HTML is interpolated from document text.
const HL_START = '\u0002'
const HL_END = '\u0003'
const HIGHLIGHT_RE = /\u0002([^\u0003]*)\u0003/g

function HighlightedText({ text, className }: { text: string; className?: string }) {
  if (!text.includes(HL_START)) {
    return <span className={className}>{text}</span>
  }

  const parts = text.split(HIGHLIGHT_RE)
  return (
    <span className={className}>
      {parts.map((part, index) =>
        // Odd indexes are the captured (matched) segments.
        index % 2 === 1 ? (
          <mark key={`hl-${index}`} className='rounded-[3px] bg-primary/15 px-0.5 text-foreground'>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  )
}

export function CommandPalette() {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const open = useCommandPaletteStore((state) => state.open)
  const setOpen = useCommandPaletteStore((state) => state.setOpen)
  const toggle = useCommandPaletteStore((state) => state.toggle)
  const documents = useDocumentStore((state) => state.documents)
  const { createDocument } = useCreateDocument()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 150)
  const trimmed = debouncedSearch.trim()
  const isSearching = trimmed.length > 0

  // Server-side full-text search (FTS5 + BM25). Only runs while the palette is
  // open and there's a query; previous results stay visible between keystrokes.
  const searchResults = useQuery(
    trpc.documents.searchDocuments.queryOptions(
      { query: trimmed, limit: 50 },
      { enabled: open && isSearching, placeholderData: keepPreviousData }
    )
  )

  // ⌘K / Ctrl+K toggles the palette from anywhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggle()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  // Clear the query each time the palette closes so it reopens fresh.
  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  const runAndClose = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  const actions: CommandAction[] = [
    {
      id: 'new-document',
      label: 'New document',
      icon: <IconPlus />,
      keywords: ['create', 'new', 'article', 'write', 'draft'],
      run: () => runAndClose(createDocument),
    },
    {
      id: 'go-library',
      label: 'Go to Library',
      icon: <IconAlignJustified />,
      keywords: ['home', 'documents', 'workspace'],
      run: () => runAndClose(() => navigate({ to: '/app' })),
    },
    {
      id: 'go-profile',
      label: 'Go to Profile',
      icon: <IconUserCircle />,
      keywords: ['account', 'me'],
      run: () =>
        runAndClose(() => navigate({ to: '/u/$username', params: { username: 'profile' } })),
    },
    {
      id: 'go-settings',
      label: 'Open Settings',
      icon: <IconSettings />,
      keywords: ['preferences', 'config'],
      run: () => runAndClose(() => navigate({ to: '/app/settings' })),
    },
  ]

  // cmdk filtering is off (the server ranks documents), so we filter the action
  // list ourselves with a simple contains match.
  const query = trimmed.toLowerCase()
  const visibleActions = isSearching
    ? actions.filter(
        (action) =>
          action.label.toLowerCase().includes(query) ||
          action.keywords.some((keyword) => keyword.includes(query))
      )
    : actions

  // Recent documents (from the already-loaded client store) for the empty state.
  const recentDocuments = useMemo(
    () =>
      Object.values(documents)
        .sort((a, b) => {
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
          return bTime - aTime
        })
        .slice(0, 7),
    [documents]
  )

  const results = searchResults.data ?? []
  const showLoading = isSearching && searchResults.isFetching && results.length === 0

  const openDocument = (docId: string) =>
    runAndClose(() => navigate({ to: '/write/$docId', params: { docId } }))

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label='Command palette'
      shouldFilter={false}
      loop
      className='flex flex-col overflow-hidden'
      overlayClassName='fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
      contentClassName={cn(
        '-translate-x-1/2 fixed top-[12vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border bg-popover text-popover-foreground outline-none',
        'shadow-[0_16px_48px_-12px_rgba(0,0,0,0.25),0_4px_16px_-8px_rgba(0,0,0,0.15)]',
        'data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2'
      )}
    >
      <div className='flex items-center gap-2.5 border-b px-4'>
        <IconSearch className='size-4.5 shrink-0 text-muted-foreground' />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          autoFocus
          placeholder='Search documents or run a command…'
          className='h-12 w-full bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground'
        />
        {isSearching && searchResults.isFetching ? (
          <IconLoader2 className='size-4 shrink-0 animate-spin text-muted-foreground' />
        ) : null}
      </div>

      <Command.List className='max-h-[min(24rem,60vh)] scroll-py-2 overflow-y-auto overflow-x-hidden'>
        {showLoading ? (
          <Command.Loading>
            <div className='flex items-center gap-2.5 px-3.5 py-8 text-muted-foreground text-sm'>
              <IconLoader2 className='size-4 animate-spin' />
              Searching…
            </div>
          </Command.Loading>
        ) : (
          <Command.Empty className='py-10 text-center text-muted-foreground text-sm'>
            {isSearching ? `No matches for “${trimmed}”` : 'No results found.'}
          </Command.Empty>
        )}

        {visibleActions.length > 0 && (
          <Command.Group heading='Actions' className={groupClassName}>
            {visibleActions.map((action) => (
              <Command.Item
                key={action.id}
                value={action.id}
                onSelect={action.run}
                className={itemClassName}
              >
                {action.icon}
                <span className='truncate'>{action.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {!isSearching && recentDocuments.length > 0 && (
          <Command.Group heading='Recent' className={groupClassName}>
            {recentDocuments.map((doc) => (
              <Command.Item
                key={doc.id}
                value={doc.id}
                onSelect={() => openDocument(doc.id)}
                className={itemClassName}
              >
                <IconFileText />
                <span className='min-w-0 flex-1 truncate'>{doc.title?.trim() || 'Untitled'}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {isSearching && results.length > 0 && (
          <Command.Group heading='Documents' className={groupClassName}>
            {results.map((doc) => (
              <Command.Item
                key={doc.id}
                value={doc.id}
                onSelect={() => openDocument(doc.id)}
                className={itemClassName}
              >
                <IconFileText />
                <span className='flex min-w-0 flex-1 flex-col'>
                  <HighlightedText
                    text={doc.titleHighlighted ?? doc.title ?? 'Untitled'}
                    className='truncate'
                  />
                  {doc.snippet ? (
                    <HighlightedText
                      text={doc.snippet}
                      className='truncate text-muted-foreground text-xs'
                    />
                  ) : doc.subtitle ? (
                    <span className='truncate text-muted-foreground text-xs'>{doc.subtitle}</span>
                  ) : null}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>

      <div className='flex items-center justify-between gap-2 border-t px-4 py-2.5 text-muted-foreground text-xs'>
        <span className='font-medium'>Lemma</span>
        <span className='flex items-center gap-1.5'>
          <IconCornerDownLeft className='size-3.5' />
          to select
          <kbd className='ml-1.5 rounded border bg-muted px-1.5 py-0.5 font-medium font-sans text-[10px]'>
            Esc
          </kbd>
          to close
        </span>
      </div>
    </Command.Dialog>
  )
}
