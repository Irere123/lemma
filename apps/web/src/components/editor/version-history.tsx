import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { useTRPC } from '@/trpc/client'
import { Button } from '../ui/button'
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPopup,
  SheetTitle,
} from '../ui/sheet'

const REASON_LABEL: Record<string, string> = {
  auto: 'Saved while writing',
  'before-large-edit': 'Before a large deletion',
  publish: 'Published',
  'before-restore': 'Before restoring an older version',
  'before-migration': 'Before a Lemma update',
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

function dayLabel(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60_000)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return dayFormat.format(date)
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

function changeSummary(revision: {
  changes: { added: string[]; removed: string[]; changed: string[] }
  titleChanged: boolean
  subtitleChanged: boolean
}): string {
  const { added, removed, changed } = revision.changes
  const parts = [
    changed.length > 0 ? `${plural(changed.length, 'block')} changed` : '',
    added.length > 0 ? `${plural(added.length, 'block')} added` : '',
    removed.length > 0 ? `${plural(removed.length, 'block')} removed` : '',
    revision.titleChanged ? 'the title changed' : '',
    revision.subtitleChanged ? 'the subtitle changed' : '',
  ].filter(Boolean)
  return parts.length === 0
    ? 'Same as the current version.'
    : `Since this version, ${parts.join(', ')}. Changed blocks are highlighted.`
}

export function VersionHistory({
  documentId,
  open,
  onOpenChange,
}: {
  documentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<number | null>(null)

  const revisions = useQuery({
    ...trpc.documents.listRevisions.queryOptions({ id: documentId }),
    enabled: open,
    staleTime: 0,
  })
  const revision = useQuery({
    ...trpc.documents.getRevision.queryOptions({ id: documentId, revisionId: selected ?? 1 }),
    enabled: open && selected !== null,
    staleTime: 0,
  })
  const restore = useMutation(trpc.documents.restoreRevision.mutationOptions())

  // Open on the newest version.
  useEffect(() => {
    if (!open) setSelected(null)
    else if (selected === null && revisions.data?.[0]) setSelected(revisions.data[0].id)
  }, [open, revisions.data, selected])

  const groups = useMemo(() => {
    const out: { day: string; items: NonNullable<typeof revisions.data> }[] = []
    for (const item of revisions.data ?? []) {
      const day = dayLabel(item.createdAt)
      const last = out[out.length - 1]
      if (last?.day === day) last.items.push(item)
      else out.push({ day, items: [item] })
    }
    return out
  }, [revisions.data])

  // Blocks that differ from the current version, highlighted in the preview.
  const highlight = useMemo(() => {
    const changes = revision.data?.changes
    if (!changes) return ''
    const select = (ids: string[]) => ids.map((id) => `.version-preview [id="${id}"]`).join(',')
    return [
      changes.changed.length > 0
        ? `${select(changes.changed)}{background:var(--version-changed)}`
        : '',
      changes.removed.length > 0
        ? `${select(changes.removed)}{background:var(--version-removed)}`
        : '',
    ].join('')
  }, [revision.data?.changes])

  const onRestore = async () => {
    if (selected === null || !revision.data) return
    try {
      await restore.mutateAsync({ id: documentId, revisionId: selected })
      await queryClient.invalidateQueries({
        queryKey: trpc.documents.listRevisions.queryKey({ id: documentId }),
      })
      toast.success(
        `Restored the version from ${dayLabel(revision.data.createdAt).toLowerCase()} at ${timeFormat.format(revision.data.createdAt)}. The text it replaced is in the history too.`
      )
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      toast.error('Could not restore this version.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPopup side='right' className='max-w-4xl'>
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Lemma keeps a version every 10 minutes while you write, when you stop, before any large
            deletion and each time you publish.
          </SheetDescription>
        </SheetHeader>
        <div className='flex min-h-0 flex-1 border-t'>
          <nav
            aria-label='Versions'
            className='w-64 shrink-0 overflow-y-auto border-e p-2 text-sm max-sm:w-40'
          >
            {revisions.isLoading ? (
              <Loader2 className='m-4 size-4 animate-spin text-muted-foreground' />
            ) : groups.length === 0 ? (
              <p className='p-3 text-muted-foreground'>
                No earlier versions yet. The first one is kept a few minutes after you start
                writing.
              </p>
            ) : (
              groups.map((group) => (
                <section key={group.day} className='mb-2'>
                  <h3 className='px-2 pt-2 pb-1 font-medium text-muted-foreground text-xs'>
                    {group.day}
                  </h3>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <button
                          type='button'
                          aria-current={item.id === selected ? 'true' : undefined}
                          onClick={() => setSelected(item.id)}
                          className={cn(
                            'w-full rounded-md px-2 py-1.5 text-left hover:bg-accent',
                            item.id === selected && 'bg-accent'
                          )}
                        >
                          <span className='block font-medium'>
                            {timeFormat.format(item.createdAt)}
                          </span>
                          <span className='block text-muted-foreground text-xs'>
                            {REASON_LABEL[item.reason] ?? item.reason} ·{' '}
                            {item.words.toLocaleString()} words
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </nav>
          <div className='min-w-0 flex-1 overflow-y-auto p-6'>
            {revision.isLoading && selected !== null ? (
              <Loader2 className='size-4 animate-spin text-muted-foreground' />
            ) : revision.data ? (
              <article className='version-preview'>
                <p className='mb-4 rounded-md bg-muted/60 px-3 py-2 text-muted-foreground text-xs'>
                  {changeSummary(revision.data)}
                </p>
                {highlight ? <style>{highlight}</style> : null}
                <h1 className='mb-2 font-semibold text-3xl'>{revision.data.title || 'Untitled'}</h1>
                {revision.data.subtitle ? (
                  <p className='mb-6 text-lg text-muted-foreground'>{revision.data.subtitle}</p>
                ) : null}
                <div
                  className='writer-prose'
                  // Rendered by the server's published-page renderer (sanitised).
                  dangerouslySetInnerHTML={{ __html: revision.data.html }}
                />
              </article>
            ) : null}
          </div>
        </div>
        <SheetFooter>
          <Button type='button' variant='ghost' onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type='button'
            onClick={() => void onRestore()}
            disabled={!revision.data || restore.isPending}
          >
            {restore.isPending ? <Loader2 className='animate-spin' /> : <History />}
            Restore this version
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  )
}
