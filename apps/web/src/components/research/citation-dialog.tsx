import { type CslItem, detectIdentifier } from '@lemma/content/citations'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { isMac } from '@/lib/keys'
import { referenceSearchText, shortReference } from '@/lib/research/format'
import { cn } from '@/lib/utils'
import { useTRPC } from '@/trpc/client'

export type CitationValue = {
  items: { id: string; locator?: string; label?: string; prefix?: string; suffix?: string }[]
  mode: 'normal' | 'suppress-author' | 'author-in-text'
}

const LABELS = [
  { value: 'page', label: 'p.' },
  { value: 'chapter', label: 'ch.' },
  { value: 'section', label: '§' },
  { value: 'figure', label: 'fig.' },
] as const

const MODES: { value: CitationValue['mode']; label: string; example: string }[] = [
  { value: 'normal', label: 'In brackets', example: '(Smith, 2020)' },
  { value: 'author-in-text', label: 'Author in the sentence', example: 'Smith (2020)' },
  { value: 'suppress-author', label: 'Year only', example: '(2020)' },
]

/**
 * Cite one or more sources: search the library (or paste a DOI, arXiv ID,
 * ISBN or URL to add one), add page numbers, choose how it reads. Used to
 * insert a citation and to edit one (click it in the text).
 */
export function CitationDialog({
  value,
  onClose,
  onSave,
}: {
  value: CitationValue | null
  onClose: () => void
  onSave: (value: CitationValue) => void
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: library = [] } = useQuery(trpc.references.list.queryOptions())
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<CitationValue['items']>([])
  const [mode, setMode] = useState<CitationValue['mode']>('normal')
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!value) return
    setChosen(value.items)
    setMode(value.mode)
    setQuery('')
  }, [value])

  const add = useMutation(
    trpc.references.addByIdentifier.mutationOptions({
      onSuccess: ({ item }) => {
        void queryClient.invalidateQueries({ queryKey: trpc.references.list.queryKey() })
        if (item)
          setChosen((current) =>
            current.some((entry) => entry.id === item.id) ? current : [...current, { id: item.id }]
          )
        setQuery('')
      },
      onError: (error) => toast.error(error.message),
    })
  )

  const byId = useMemo(() => new Map(library.map((item) => [item.id, item])), [library])
  const needle = query.trim().toLowerCase()
  const results = useMemo(
    () =>
      (needle
        ? library.filter((item) => referenceSearchText(item).includes(needle))
        : library
      ).slice(0, 30),
    [library, needle]
  )
  const identifier = query.trim() ? detectIdentifier(query.trim()) : null
  const toggle = (id: string) =>
    setChosen((current) =>
      current.some((entry) => entry.id === id)
        ? current.filter((entry) => entry.id !== id)
        : [...current, { id }]
    )
  const update = (id: string, patch: Partial<CitationValue['items'][number]>) =>
    setChosen((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    )

  const save = () => {
    if (chosen.length === 0) return
    onSave({
      items: chosen.map((entry) => {
        const clean: CitationValue['items'][number] = { id: entry.id }
        if (entry.locator?.trim()) {
          clean.locator = entry.locator.trim()
          if (entry.label && entry.label !== 'page') clean.label = entry.label
        }
        return clean
      }),
      mode,
    })
  }

  const describe = (csl: CslItem | undefined) => (csl ? shortReference(csl) : 'Missing reference')
  const mod = isMac() ? '⌘' : 'Ctrl'

  return (
    <Dialog open={value !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className='max-w-xl' initialFocus={field}>
        <DialogHeader>
          <DialogTitle>Cite</DialogTitle>
          <DialogDescription>
            Search your library, or paste a DOI, arXiv ID, ISBN or link to add a source.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className='flex flex-col gap-3'>
          <form
            className='relative'
            onSubmit={(event) => {
              event.preventDefault()
              if (identifier) add.mutate({ input: query.trim() })
              else if (results[0]) toggle(results[0].id)
            }}
          >
            <Search className='-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 text-muted-foreground' />
            <Input
              ref={field}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  save()
                }
              }}
              placeholder='Author, title, year, or a DOI'
              aria-label='Search references'
              className='pl-8'
            />
          </form>

          <div
            className='max-h-64 overflow-y-auto rounded-lg border border-border/70'
            role='listbox'
            aria-label='References'
            aria-multiselectable
          >
            {identifier ? (
              <button
                type='button'
                onClick={() => add.mutate({ input: query.trim() })}
                disabled={add.isPending}
                className='flex w-full items-center gap-2.5 border-border/70 border-b px-3 py-2.5 text-left text-[14px] hover:bg-accent'
              >
                {add.isPending ? (
                  <Loader2 className='size-4 animate-spin' />
                ) : (
                  <Plus className='size-4 text-muted-foreground' />
                )}
                Look up{' '}
                {identifier.kind === 'url'
                  ? 'this page'
                  : `this ${identifier.kind === 'arxiv' ? 'arXiv paper' : identifier.kind.toUpperCase()}`}{' '}
                and add it
              </button>
            ) : null}
            {results.length === 0 && !identifier ? (
              <p className='px-3 py-6 text-center text-[13.5px] text-muted-foreground'>
                {library.length === 0
                  ? 'Your library is empty. Paste a DOI above to add a source.'
                  : 'Nothing matches.'}
              </p>
            ) : (
              results.map((item) => {
                const selected = chosen.some((entry) => entry.id === item.id)
                return (
                  <button
                    key={item.id}
                    type='button'
                    role='option'
                    aria-selected={selected}
                    onClick={() => toggle(item.id)}
                    className='flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-accent/70 aria-selected:bg-brand-soft'
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border',
                        selected ? 'border-brand bg-brand text-brand-foreground' : 'border-input'
                      )}
                    >
                      {selected ? <Check className='size-3' /> : null}
                    </span>
                    <span className='min-w-0'>
                      <span className='block truncate font-medium text-[13.5px]'>
                        {shortReference(item.csl)}
                      </span>
                      <span className='block truncate text-[12.5px] text-muted-foreground'>
                        {item.csl.title ?? item.key}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {chosen.length > 0 ? (
            <div className='flex flex-col gap-1.5'>
              {chosen.map((entry) => (
                <div
                  key={entry.id}
                  className='flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5'
                >
                  <span className='min-w-0 flex-1 truncate text-[13.5px]'>
                    {describe(byId.get(entry.id)?.csl)}
                  </span>
                  <select
                    aria-label='Locator type'
                    value={entry.label ?? 'page'}
                    onChange={(event) => update(entry.id, { label: event.currentTarget.value })}
                    className='h-7 rounded-md border border-input bg-background px-1 text-[12.5px]'
                  >
                    {LABELS.map((label) => (
                      <option key={label.value} value={label.value}>
                        {label.label}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label='Page or other locator'
                    placeholder='12'
                    value={entry.locator ?? ''}
                    onChange={(event) => update(entry.id, { locator: event.currentTarget.value })}
                    className='h-7 w-16 rounded-md border border-input bg-background px-2 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  />
                  <button
                    type='button'
                    aria-label='Remove'
                    onClick={() => toggle(entry.id)}
                    className='text-muted-foreground hover:text-foreground'
                  >
                    <X className='size-3.5' />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <fieldset className='flex flex-wrap gap-1.5'>
            <legend className='sr-only'>How the citation reads</legend>
            {MODES.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] transition-colors',
                  mode === option.value
                    ? 'border-brand bg-brand-soft text-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent'
                )}
              >
                <input
                  type='radio'
                  name='citation-mode'
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                  className='sr-only'
                />
                {option.label}
                <span className='font-serif text-muted-foreground'>{option.example}</span>
              </label>
            ))}
          </fieldset>
        </DialogPanel>
        <DialogFooter className='items-center'>
          <span className='mr-auto hidden items-center gap-1.5 text-[12px] text-muted-foreground sm:flex'>
            <KbdGroup>
              <Kbd>{mod}</Kbd>
              <Kbd>↵</Kbd>
            </KbdGroup>
            to {value?.items.length ? 'update' : 'insert'}
          </span>
          <Button variant='ghost' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={chosen.length === 0}>
            {value?.items.length ? 'Update citation' : 'Insert citation'}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
