import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen, FileText, NotebookPen, Sun } from 'lucide-react'
import type { ReactNode } from 'react'

import { BookCover } from '@/components/workspace/book-cover'
import { KindIcon } from '@/components/workspace/kind'
import { Page, SectionHeading } from '@/components/workspace/page'
import { Progress } from '@/components/workspace/progress'
import { useCreate } from '@/hooks/use-create'
import { useSession } from '@/lib/auth-client'
import { formatNumber, formatWords, greeting, longDate, relativeTime } from '@/lib/format'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/app/')({
  component: Home,
})

function Home() {
  const trpc = useTRPC()
  const { data: session } = useSession()
  const create = useCreate()
  const { data: recent, isLoading } = useQuery(
    trpc.documents.getUserDocuments.queryOptions({ kinds: ['post', 'chapter', 'note'], limit: 12 })
  )
  const { data: books } = useQuery(trpc.books.list.queryOptions())
  const docs = recent?.documents ?? []
  const firstName = session?.user?.name?.split(' ')[0]
  const continueWriting = docs.filter((doc) => doc.kind !== 'note').slice(0, 3)
  const notes = docs.filter((doc) => doc.kind === 'note').slice(0, 5)

  return (
    <Page wide>
      <header className='mb-10'>
        <p className='text-[13px] text-muted-foreground'>{longDate()}</p>
        <h1 className='mt-1 font-semibold text-[2rem] text-foreground leading-tight tracking-tight'>
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
      </header>

      <div className='mb-12 grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <QuickAction
          icon={<FileText />}
          title='New post'
          hint='Write for your readers'
          onClick={create.createPost}
        />
        <QuickAction
          icon={<NotebookPen />}
          title='New note'
          hint='Capture an idea'
          onClick={create.createNote}
        />
        <QuickAction
          icon={<Sun />}
          title='Today’s note'
          hint='Your daily page'
          onClick={create.openToday}
        />
        <QuickAction
          icon={<BookOpen />}
          title='New book'
          hint='Chapters, targets, export'
          onClick={create.createBook}
        />
      </div>

      <section className='mb-12'>
        <SectionHeading
          action={
            <Link
              to='/app/posts'
              className='inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground'
            >
              All posts <ArrowRight className='size-3.5' />
            </Link>
          }
        >
          Continue writing
        </SectionHeading>
        {isLoading ? (
          <div className='grid gap-3 md:grid-cols-3'>
            {[0, 1, 2].map((key) => (
              <div key={key} className='h-36 animate-pulse rounded-xl bg-muted' />
            ))}
          </div>
        ) : continueWriting.length === 0 ? (
          <p className='rounded-xl border border-dashed px-5 py-8 text-center text-[14px] text-muted-foreground'>
            Nothing in progress. Start a post, a note or a book above.
          </p>
        ) : (
          <div className='grid gap-3 md:grid-cols-3'>
            {continueWriting.map((doc) => (
              <Link
                key={doc.id}
                to='/write/$docId'
                params={{ docId: doc.id }}
                className='group flex min-h-36 flex-col rounded-xl bg-card p-4 shadow-surface outline-none transition-[box-shadow,translate] duration-150 hover:-translate-y-px hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring'
              >
                <span className='flex items-center gap-1.5 text-[12px] text-muted-foreground'>
                  <KindIcon kind={doc.kind} className='size-3.5' />
                  {doc.kind === 'chapter'
                    ? 'Chapter'
                    : doc.status === 'PUBLISHED'
                      ? 'Published'
                      : 'Draft'}
                </span>
                <span className='mt-2 line-clamp-2 font-semibold text-[16px] text-foreground leading-snug tracking-tight'>
                  {doc.title?.trim() || 'Untitled'}
                </span>
                <span className='mt-1.5 line-clamp-2 font-serif text-[14px] text-muted-foreground leading-relaxed'>
                  {doc.excerpt || 'No text yet.'}
                </span>
                <span className='mt-auto pt-3 text-[12px] text-muted-foreground tabular-nums'>
                  {relativeTime(doc.updatedAt)} · {formatWords(doc.wordCount)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className='grid gap-12 lg:grid-cols-[1.4fr_1fr]'>
        <section>
          <SectionHeading
            action={
              <Link
                to='/app/books'
                className='inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground'
              >
                All books <ArrowRight className='size-3.5' />
              </Link>
            }
          >
            Books
          </SectionHeading>
          {books && books.length > 0 ? (
            <div className='grid gap-3 sm:grid-cols-2'>
              {books.slice(0, 4).map((book) => (
                <Link
                  key={book.id}
                  to='/app/books/$bookId'
                  params={{ bookId: book.id }}
                  className='flex gap-3.5 rounded-xl bg-card p-3 shadow-surface outline-none transition-shadow hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring'
                >
                  <BookCover title={book.title} image={book.coverImage} className='w-14' />
                  <div className='flex min-w-0 flex-1 flex-col py-0.5'>
                    <span className='truncate font-semibold text-[14.5px] text-foreground'>
                      {book.title || 'Untitled book'}
                    </span>
                    <span className='mt-0.5 text-[12.5px] text-muted-foreground'>
                      {book.chapters} {book.chapters === 1 ? 'chapter' : 'chapters'} ·{' '}
                      {formatNumber(book.words)} words
                    </span>
                    {book.wordTarget ? (
                      <Progress
                        value={book.words / book.wordTarget}
                        className='mt-auto'
                        label={`${book.title || 'Book'} progress`}
                      />
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <button
              type='button'
              onClick={create.createBook}
              className='flex w-full items-center gap-4 rounded-xl border border-dashed px-5 py-6 text-left transition-colors hover:bg-accent/50'
            >
              <BookCover title='Your book' className='w-11' />
              <span>
                <span className='block font-medium text-[14.5px]'>Start a book</span>
                <span className='block text-[13px] text-muted-foreground'>
                  Chapters you can reorder, word targets, EPUB and Word export.
                </span>
              </span>
            </button>
          )}
        </section>

        <section>
          <SectionHeading
            action={
              <Link
                to='/app/notes'
                className='inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground'
              >
                All notes <ArrowRight className='size-3.5' />
              </Link>
            }
          >
            Recent notes
          </SectionHeading>
          {notes.length > 0 ? (
            <ul className='flex flex-col'>
              {notes.map((note) => (
                <li key={note.id}>
                  <Link
                    to='/write/$docId'
                    params={{ docId: note.id }}
                    className='-mx-2 flex items-baseline gap-3 rounded-md px-2 py-2 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring'
                  >
                    <span className='min-w-0 flex-1 truncate text-[14px] text-foreground'>
                      {note.title?.trim() || note.excerpt || 'Untitled note'}
                    </span>
                    <span className='shrink-0 text-[12px] text-muted-foreground'>
                      {relativeTime(note.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-[13.5px] text-muted-foreground'>
              Notes are private. Link them with <span className='font-mono text-[12.5px]'>[[</span>,
              and they show what links back.
            </p>
          )}
        </section>
      </div>
    </Page>
  )
}

function QuickAction({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: ReactNode
  title: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='group flex items-center gap-3 rounded-xl bg-card p-3.5 text-left shadow-surface outline-none transition-[box-shadow,translate] duration-150 hover:-translate-y-px hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring'
    >
      <span className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/80 transition-colors group-hover:bg-brand-soft group-hover:text-brand [&_svg]:size-[18px]'>
        {icon}
      </span>
      <span className='min-w-0'>
        <span className='block truncate font-medium text-[14px] text-foreground'>{title}</span>
        <span className='block truncate text-[12.5px] text-muted-foreground'>{hint}</span>
      </span>
    </button>
  )
}
