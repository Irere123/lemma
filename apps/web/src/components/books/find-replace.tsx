import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Loader2, Replace, Search } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from '@/components/ui/sheet'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatNumber } from '@/lib/format'
import { useTRPC } from '@/trpc/client'

/**
 * Find & replace across every chapter of a book. Matches show in context as
 * you type; "Replace all" changes every chapter at once, and each changed
 * chapter keeps its earlier version, so Undo puts the whole book back.
 */
export function BookFindReplace({
  bookId,
  open,
  onOpenChange,
}: {
  bookId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const debounced = useDebouncedValue(find, 250)
  const options = { bookId, find: debounced, caseSensitive, wholeWord }

  const results = useQuery({
    ...trpc.books.find.queryOptions(options),
    enabled: open && debounced.length > 0,
  })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.books.find.pathKey() })
    void queryClient.invalidateQueries({ queryKey: trpc.books.get.queryKey({ bookId }) })
  }
  const undo = useMutation(
    trpc.books.undoReplace.mutationOptions({
      onSuccess: ({ restored }) => {
        toast.success(`Restored ${restored} ${restored === 1 ? 'chapter' : 'chapters'}`)
        refresh()
      },
      onError: (error) => toast.error(error.message),
    })
  )
  const replaceAll = useMutation(
    trpc.books.replaceAll.mutationOptions({
      onSuccess: ({ total, chapters }) => {
        refresh()
        toast.success(
          `Replaced ${formatNumber(total)} ${total === 1 ? 'match' : 'matches'} in ${chapters.length} ${
            chapters.length === 1 ? 'chapter' : 'chapters'
          }`,
          {
            duration: 12_000,
            action: {
              label: 'Undo',
              onClick: () =>
                undo.mutate({ bookId, chapterIds: chapters.map((chapter) => chapter.id) }),
            },
          }
        )
      },
      onError: (error) => toast.error(error.message),
    })
  )

  const total = results.data?.total ?? 0
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPopup side='right' className='w-full sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>Find and replace</SheetTitle>
          <SheetDescription>Across every chapter of this book.</SheetDescription>
        </SheetHeader>
        <SheetPanel className='flex flex-col gap-4'>
          <form
            className='flex flex-col gap-3'
            onSubmit={(event) => {
              event.preventDefault()
              if (find && total > 0) replaceAll.mutate({ ...options, find, replace })
            }}
          >
            <div className='relative'>
              <Search className='-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 text-muted-foreground' />
              <Input
                autoFocus
                value={find}
                onChange={(event) => setFind(event.currentTarget.value)}
                placeholder='Find'
                aria-label='Find'
                className='pl-8'
              />
            </div>
            <div className='relative'>
              <Replace className='-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 text-muted-foreground' />
              <Input
                value={replace}
                onChange={(event) => setReplace(event.currentTarget.value)}
                placeholder='Replace with'
                aria-label='Replace with'
                className='pl-8'
              />
            </div>
            <div className='flex items-center gap-5'>
              <Label className='flex items-center gap-2 font-normal text-[13px]'>
                <Checkbox
                  checked={caseSensitive}
                  onCheckedChange={(value) => setCaseSensitive(value === true)}
                />
                Match case
              </Label>
              <Label className='flex items-center gap-2 font-normal text-[13px]'>
                <Checkbox
                  checked={wholeWord}
                  onCheckedChange={(value) => setWholeWord(value === true)}
                />
                Whole words
              </Label>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <span className='text-[13px] text-muted-foreground' aria-live='polite'>
                {!debounced
                  ? 'Type to search the book.'
                  : results.isFetching
                    ? 'Searching…'
                    : `${formatNumber(total)} ${total === 1 ? 'match' : 'matches'} in ${results.data?.chapters.length ?? 0} ${
                        results.data?.chapters.length === 1 ? 'chapter' : 'chapters'
                      }`}
              </span>
              <Button type='submit' disabled={!find || total === 0 || replaceAll.isPending}>
                {replaceAll.isPending ? <Loader2 className='animate-spin' /> : null}
                Replace all
              </Button>
            </div>
          </form>

          <div className='flex flex-col gap-4'>
            {results.data?.chapters.map((chapter) => (
              <section key={chapter.id}>
                <h3 className='mb-1.5 flex items-baseline justify-between gap-3 font-medium text-[13.5px]'>
                  <Link
                    to='/write/$docId'
                    params={{ docId: chapter.id }}
                    className='truncate hover:underline'
                  >
                    {chapter.title || 'Untitled chapter'}
                  </Link>
                  <span className='shrink-0 text-[12px] text-muted-foreground'>
                    {chapter.count}
                  </span>
                </h3>
                <ul className='flex flex-col gap-1'>
                  {chapter.matches.map((match, index) => (
                    <li
                      key={`${chapter.id}-${index}`}
                      className='rounded-md bg-muted/60 px-2.5 py-1.5 font-serif text-[13.5px] text-muted-foreground leading-snug'
                    >
                      …{match.before}
                      <mark className='rounded-[3px] bg-brand-soft px-0.5 text-foreground'>
                        {match.match}
                      </mark>
                      {replace ? (
                        <ins className='ml-0.5 rounded-[3px] bg-success/12 px-0.5 text-success-foreground no-underline'>
                          {replace}
                        </ins>
                      ) : null}
                      {match.after}…
                    </li>
                  ))}
                  {chapter.count > chapter.matches.length ? (
                    <li className='px-2.5 text-[12px] text-muted-foreground'>
                      and {chapter.count - chapter.matches.length} more
                    </li>
                  ) : null}
                </ul>
              </section>
            ))}
          </div>
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  )
}
