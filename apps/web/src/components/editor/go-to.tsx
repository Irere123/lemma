import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Command } from 'cmdk'
import { BookOpen, FileText, Hash, NotebookPen } from 'lucide-react'

import { Dialog, DialogPopup, DialogTitle } from '@/components/ui/dialog'
import { useTRPC } from '@/trpc/client'
import type { OutlineHeading } from '../books/chapter-sidebar'

const ITEM =
  'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] outline-none data-[selected=true]:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'
const GROUP =
  'px-1 pb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em]'

/**
 * ⌘P: go to a heading in this document, another chapter of the book, or a
 * recent document, by typing part of its name.
 */
export function GoToDialog({
  open,
  onOpenChange,
  headings,
  bookId,
  currentId,
  onJump,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  headings: OutlineHeading[]
  bookId?: string | null
  currentId: string
  onJump: (pos: number) => void
}) {
  const trpc = useTRPC()
  const navigate = useNavigate()
  const book = useQuery({
    ...trpc.books.get.queryOptions({ bookId: bookId ?? '' }),
    enabled: open && Boolean(bookId),
  })
  const recent = useQuery({
    ...trpc.documents.getUserDocuments.queryOptions({
      kinds: ['post', 'chapter', 'note'],
      limit: 30,
    }),
    enabled: open,
  })
  const go = (docId: string) => {
    onOpenChange(false)
    void navigate({ to: '/write/$docId', params: { docId } })
  }
  const chapters = (book.data?.entries ?? []).filter((entry) => entry.kind === 'chapter')
  const chapterIds = new Set(chapters.map((chapter) => chapter.id))
  const others = (recent.data?.documents ?? []).filter(
    (doc) => doc.id !== currentId && !chapterIds.has(doc.id)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className='max-w-lg overflow-hidden p-0' showCloseButton={false}>
        <DialogTitle className='sr-only'>Go to</DialogTitle>
        <Command loop className='flex max-h-[min(28rem,70vh)] flex-col'>
          <Command.Input
            placeholder='Go to a heading, chapter or document…'
            className='h-12 border-border/70 border-b bg-transparent px-4 text-[15px] outline-none placeholder:text-muted-foreground'
          />
          <Command.List className='overflow-y-auto py-2'>
            <Command.Empty className='px-4 py-8 text-center text-[13.5px] text-muted-foreground'>
              Nothing matches.
            </Command.Empty>
            {headings.length > 0 ? (
              <Command.Group heading='In this document' className={GROUP}>
                {headings.map((heading) => (
                  <Command.Item
                    key={heading.id}
                    value={`heading ${heading.label} ${heading.id}`}
                    onSelect={() => {
                      onOpenChange(false)
                      onJump(heading.pos)
                    }}
                    className={ITEM}
                  >
                    <Hash />
                    <span
                      className='truncate'
                      style={{ paddingLeft: `${Math.max(0, heading.level - 2) * 0.75}rem` }}
                    >
                      {heading.label}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            {chapters.length > 0 ? (
              <Command.Group heading={book.data?.book.title || 'Chapters'} className={GROUP}>
                {chapters.map((chapter, index) => (
                  <Command.Item
                    key={chapter.id}
                    value={`chapter ${index + 1} ${chapter.title ?? ''} ${chapter.id}`}
                    onSelect={() => go(chapter.id)}
                    className={ITEM}
                  >
                    <BookOpen />
                    <span className='w-5 shrink-0 text-right font-serif text-[13px] text-muted-foreground tabular-nums'>
                      {index + 1}
                    </span>
                    <span className='truncate'>{chapter.title || 'Untitled chapter'}</span>
                    {chapter.id === currentId ? (
                      <span className='ml-auto text-[12px] text-muted-foreground'>Here</span>
                    ) : null}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            {others.length > 0 ? (
              <Command.Group heading='Recent' className={GROUP}>
                {others.map((doc) => (
                  <Command.Item
                    key={doc.id}
                    value={`doc ${doc.title ?? ''} ${doc.id}`}
                    onSelect={() => go(doc.id)}
                    className={ITEM}
                  >
                    {doc.kind === 'note' ? (
                      <NotebookPen />
                    ) : doc.kind === 'chapter' ? (
                      <BookOpen />
                    ) : (
                      <FileText />
                    )}
                    <span className='truncate'>{doc.title?.trim() || 'Untitled'}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
          </Command.List>
        </Command>
      </DialogPopup>
    </Dialog>
  )
}
