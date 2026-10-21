import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  BookText,
  Download,
  ExternalLink,
  FileText,
  ImagePlus,
  Layers,
  Loader2,
  MoreHorizontal,
  Plus,
  Replace,
  Target,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { BookFindReplace } from '@/components/books/find-replace'
import { BookOutline, type OutlineEntry } from '@/components/books/outline'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
import { Label } from '@/components/ui/label'
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { Switch } from '@/components/ui/switch'
import { BookCover } from '@/components/workspace/book-cover'
import { Page } from '@/components/workspace/page'
import { Progress } from '@/components/workspace/progress'
import { uploadFile } from '@/lib/api/uploads'
import { useSession } from '@/lib/auth-client'
import { exportBook } from '@/lib/export/book'
import { formatNumber } from '@/lib/format'
import { useTRPC, useTRPCClient } from '@/trpc/client'

export const Route = createFileRoute('/app/books/$bookId')({
  component: BookPage,
})

function BookPage() {
  const { bookId } = Route.useParams()
  const trpc = useTRPC()
  const client = useTRPCClient()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const { data, isLoading, error } = useQuery(trpc.books.get.queryOptions({ bookId }))
  const [finding, setFinding] = useState(false)
  const [target, setTarget] = useState<{
    id: string | null
    title: string
    value: number | null
  } | null>(null)
  const [removing, setRemoving] = useState<OutlineEntry | null>(null)
  const [deletingBook, setDeletingBook] = useState(false)
  const [exporting, setExporting] = useState<'epub' | 'docx' | null>(null)
  const coverInput = useRef<HTMLInputElement>(null)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.books.get.queryKey({ bookId }) })
    void queryClient.invalidateQueries({ queryKey: trpc.books.list.queryKey() })
  }
  const fail = (failure: { message: string }) => toast.error(failure.message)
  const update = useMutation(
    trpc.books.update.mutationOptions({ onSuccess: refresh, onError: fail })
  )
  const reorder = useMutation(
    trpc.books.reorder.mutationOptions({ onSuccess: refresh, onError: fail })
  )
  const addEntry = useMutation(
    trpc.books.addEntry.mutationOptions({
      onSuccess: (entry) => {
        refresh()
        if (entry.kind === 'chapter')
          void navigate({ to: '/write/$docId', params: { docId: entry.id } })
      },
      onError: fail,
    })
  )
  const rename = useMutation(
    trpc.documents.upsertDocument.mutationOptions({ onSuccess: refresh, onError: fail })
  )
  const remove = useMutation(
    trpc.documents.deleteDocument.mutationOptions({
      onSuccess: () => {
        setRemoving(null)
        refresh()
      },
      onError: fail,
    })
  )
  const setEntryTarget = useMutation(
    trpc.documents.setWordTarget.mutationOptions({ onSuccess: refresh, onError: fail })
  )
  const deleteBook = useMutation(
    trpc.books.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.books.list.queryKey() })
        void navigate({ to: '/app/books' })
      },
      onError: fail,
    })
  )

  if (isLoading) {
    return (
      <Page>
        <div className='flex gap-6'>
          <div className='aspect-[2/3] w-32 animate-pulse rounded-md bg-muted' />
          <div className='flex-1 space-y-3 pt-2'>
            <div className='h-8 w-2/3 animate-pulse rounded bg-muted' />
            <div className='h-4 w-1/2 animate-pulse rounded bg-muted' />
          </div>
        </div>
      </Page>
    )
  }
  if (error || !data) {
    return (
      <Page>
        <p className='text-muted-foreground'>This book doesn’t exist, or isn’t yours.</p>
        <Link to='/app/books' className='mt-4 inline-block text-[14px] underline'>
          Back to books
        </Link>
      </Page>
    )
  }

  const { book, entries } = data
  const chapters = entries.filter((entry) => entry.kind === 'chapter')
  const words = chapters.reduce((sum, chapter) => sum + (Number(chapter.wordCount) || 0), 0)
  const published = chapters.filter((chapter) => chapter.status === 'PUBLISHED').length
  const username = session?.user?.username
  const bookUrl = username && book.slug ? `/u/${username}/b/${book.slug}` : null

  const runExport = async (format: 'epub' | 'docx') => {
    setExporting(format)
    try {
      const exportData = await client.books.exportData.query({ bookId })
      await exportBook(exportData, format)
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Export failed')
    } finally {
      setExporting(null)
    }
  }

  return (
    <Page>
      <Link
        to='/app/books'
        className='mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground'
      >
        <ArrowLeft className='size-3.5' /> Books
      </Link>

      <header className='mb-10 flex flex-col gap-6 sm:flex-row'>
        <div className='group/cover relative w-28 shrink-0 sm:w-36'>
          <BookCover title={book.title} image={book.coverImage} className='w-full text-[16px]' />
          <button
            type='button'
            onClick={() => coverInput.current?.click()}
            className='absolute inset-0 flex items-center justify-center rounded-[4px] bg-black/45 font-medium text-[12.5px] text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover/cover:opacity-100'
          >
            <ImagePlus className='mr-1.5 size-4' />
            {book.coverImage ? 'Change cover' : 'Add cover'}
          </button>
          <input
            ref={coverInput}
            type='file'
            accept='image/*'
            hidden
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0]
              if (!file) return
              try {
                const uploaded = await uploadFile(file)
                update.mutate({ bookId, coverImage: uploaded.url })
              } catch {
                toast.error('Couldn’t upload the cover')
              }
            }}
          />
        </div>
        <div className='flex min-w-0 flex-1 flex-col'>
          <InlineText
            key={`title-${book.title}`}
            value={book.title}
            placeholder='Untitled book'
            label='Book title'
            onSave={(title) => update.mutate({ bookId, title })}
            className='font-semibold text-[2rem] leading-tight tracking-tight'
          />
          <InlineText
            key={`subtitle-${book.subtitle}`}
            value={book.subtitle ?? ''}
            placeholder='Add a subtitle'
            label='Subtitle'
            onSave={(subtitle) => update.mutate({ bookId, subtitle: subtitle || null })}
            className='mt-1 font-serif text-[17px] text-muted-foreground'
          />
          <p className='mt-4 text-[13.5px] text-muted-foreground tabular-nums'>
            {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'} ·{' '}
            {formatNumber(words)} words
            {published > 0 ? ` · ${published} published` : ''}
          </p>
          <div className='mt-2 max-w-sm'>
            {book.wordTarget ? (
              <button
                type='button'
                className='block w-full text-left'
                onClick={() => setTarget({ id: null, title: book.title, value: book.wordTarget })}
              >
                <Progress value={words / book.wordTarget} label='Progress to the book’s target' />
                <span className='mt-1 block text-[12px] text-muted-foreground'>
                  of {formatNumber(book.wordTarget)} words
                </span>
              </button>
            ) : (
              <button
                type='button'
                onClick={() => setTarget({ id: null, title: book.title, value: null })}
                className='inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground'
              >
                <Target className='size-3.5' /> Set a word target
              </button>
            )}
          </div>
          <div className='mt-auto flex flex-wrap items-center gap-2 pt-5'>
            <Button variant='outline' onClick={() => setFinding(true)}>
              <Replace /> Find and replace
            </Button>
            <Menu>
              <MenuTrigger
                render={
                  <Button variant='outline' disabled={exporting !== null}>
                    {exporting ? <Loader2 className='animate-spin' /> : <Download />}
                    Export
                  </Button>
                }
              />
              <MenuPopup align='start' className='min-w-56'>
                <MenuItem onClick={() => void runExport('epub')}>
                  <BookText /> EPUB (Apple Books, e-readers)
                </MenuItem>
                <MenuItem onClick={() => void runExport('docx')}>
                  <FileText /> Word manuscript (.docx)
                </MenuItem>
              </MenuPopup>
            </Menu>
            <Label className='ml-1 flex items-center gap-2 font-normal text-[13px] text-muted-foreground'>
              <Switch
                aria-label='Public book page'
                checked={book.status === 'PUBLISHED'}
                onCheckedChange={(checked) =>
                  update.mutate({ bookId, status: checked ? 'PUBLISHED' : 'DRAFT' })
                }
              />
              Public book page
            </Label>
            {book.status === 'PUBLISHED' && bookUrl ? (
              <a
                href={bookUrl}
                target='_blank'
                rel='noreferrer'
                className='inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground'
              >
                View <ExternalLink className='size-3.5' />
              </a>
            ) : null}
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label='More book actions'
                    className='ml-auto'
                  >
                    <MoreHorizontal />
                  </Button>
                }
              />
              <MenuPopup align='end'>
                <MenuItem
                  onClick={() => setTarget({ id: null, title: book.title, value: book.wordTarget })}
                >
                  <Target /> Book word target…
                </MenuItem>
                {book.coverImage ? (
                  <MenuItem onClick={() => update.mutate({ bookId, coverImage: null })}>
                    <ImagePlus /> Remove cover
                  </MenuItem>
                ) : null}
                <MenuSeparator />
                <MenuItem variant='destructive' onClick={() => setDeletingBook(true)}>
                  <Trash2 /> Delete book…
                </MenuItem>
              </MenuPopup>
            </Menu>
          </div>
        </div>
      </header>

      <div className='mb-3 flex items-center justify-between'>
        <h2 className='font-medium text-[13px] text-muted-foreground uppercase tracking-[0.08em]'>
          Contents
        </h2>
        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => addEntry.mutate({ bookId, kind: 'part' })}
          >
            <Layers /> Part
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => addEntry.mutate({ bookId, kind: 'chapter' })}
          >
            <Plus /> Chapter
          </Button>
        </div>
      </div>
      <div className='rounded-xl bg-card p-2 shadow-surface'>
        {entries.length === 0 ? (
          <p className='px-3 py-6 text-center text-[14px] text-muted-foreground'>
            No chapters yet.
          </p>
        ) : (
          <BookOutline
            entries={entries}
            onReorder={(ids) => reorder.mutate({ bookId, ids })}
            onRename={(id, title) => rename.mutate({ id, title })}
            onAdd={(kind, afterId) => addEntry.mutate({ bookId, kind, afterId })}
            onDelete={setRemoving}
            onSetTarget={(entry) =>
              setTarget({ id: entry.id, title: entry.title ?? '', value: entry.wordTarget })
            }
          />
        )}
      </div>
      <p className='mt-3 text-[12.5px] text-muted-foreground'>
        Drag to reorder, or focus a row and press Alt with ↑ or ↓.
      </p>

      <BookFindReplace bookId={bookId} open={finding} onOpenChange={setFinding} />
      <TargetDialog
        target={target}
        onClose={() => setTarget(null)}
        onSave={(value) => {
          if (!target) return
          if (target.id) setEntryTarget.mutate({ id: target.id, wordTarget: value })
          else update.mutate({ bookId, wordTarget: value })
          setTarget(null)
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Delete “${removing?.title || 'Untitled'}”?`}
        description={
          removing?.kind === 'part'
            ? 'Only the part heading goes; its chapters stay where they are.'
            : 'The chapter and its version history are deleted. This can’t be undone.'
        }
        confirmText='Delete'
        confirmVariant='destructive'
        isConfirmLoading={remove.isPending}
        onConfirm={() => removing && remove.mutate({ id: removing.id })}
      />
      <Dialog open={deletingBook} onOpenChange={setDeletingBook}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>Delete “{book.title || 'Untitled book'}”?</DialogTitle>
            <DialogDescription>
              Keep its chapters as standalone posts, or delete them with the book.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='ghost' onClick={() => setDeletingBook(false)}>
              Cancel
            </Button>
            <Button
              variant='outline'
              onClick={() => deleteBook.mutate({ bookId, keepChapters: true })}
            >
              Keep chapters as posts
            </Button>
            <Button
              variant='destructive'
              onClick={() => deleteBook.mutate({ bookId, keepChapters: false })}
            >
              Delete everything
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </Page>
  )
}

/** Text that edits in place: looks like a heading, saves on blur or Enter. */
function InlineText({
  value,
  placeholder,
  label,
  onSave,
  className,
}: {
  value: string
  placeholder: string
  label: string
  onSave: (value: string) => void
  className?: string
}) {
  const [text, setText] = useState(value)
  const save = () => {
    if (text.trim() !== value.trim()) onSave(text.trim())
  }
  return (
    <input
      value={text}
      placeholder={placeholder}
      aria-label={label}
      onChange={(event) => setText(event.currentTarget.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          setText(value)
          event.currentTarget.blur()
        }
      }}
      className={`-mx-1.5 w-full rounded-md bg-transparent px-1.5 text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 hover:bg-accent/50 focus:bg-background focus:shadow-surface ${className ?? ''}`}
    />
  )
}

function TargetDialog({
  target,
  onClose,
  onSave,
}: {
  target: { id: string | null; title: string; value: number | null } | null
  onClose: () => void
  onSave: (value: number | null) => void
}) {
  const [text, setText] = useState('')
  // Fill the field as the dialog opens (not when its animation ends, which
  // would wipe anything typed straight away).
  useEffect(() => {
    if (target) setText(target.value ? String(target.value) : '')
  }, [target])
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPopup className='max-w-sm'>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const value = Number(text.replace(/[^\d]/g, ''))
            onSave(Number.isFinite(value) && value > 0 ? value : null)
          }}
        >
          <DialogHeader>
            <DialogTitle>Word target</DialogTitle>
            <DialogDescription>
              {target?.id ? `For “${target.title || 'Untitled'}”.` : 'For the whole book.'} Leave
              empty for none.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Input
              autoFocus
              inputMode='numeric'
              value={text}
              onChange={(event) => setText(event.currentTarget.value)}
              placeholder={target?.id ? '4,000' : '80,000'}
              aria-label='Words'
            />
          </DialogPanel>
          <DialogFooter>
            <Button type='button' variant='ghost' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit'>Save</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}
