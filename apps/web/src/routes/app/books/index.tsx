import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { BookOpen, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { BookCover } from '@/components/workspace/book-cover'
import { EmptyState, Page, PageHeader } from '@/components/workspace/page'
import { Progress } from '@/components/workspace/progress'
import { useCreate } from '@/hooks/use-create'
import { formatNumber, relativeTime } from '@/lib/format'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/app/books/')({
  component: Books,
})

function Books() {
  const trpc = useTRPC()
  const create = useCreate()
  const { data: books, isLoading } = useQuery(trpc.books.list.queryOptions())

  return (
    <Page wide>
      <PageHeader
        title='Books'
        description='Each chapter is its own document: fast to write in at any length, easy to reorder, published one at a time if you like.'
        actions={
          <Button onClick={create.createBook} disabled={create.isPending}>
            <Plus /> New book
          </Button>
        }
      />
      {isLoading ? (
        <div className='grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5'>
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className='aspect-[2/3] animate-pulse rounded-md bg-muted' />
          ))}
        </div>
      ) : !books || books.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title='No books yet'
          description='Start a novel, a thesis or a serial. Add chapters and parts, set word targets, export EPUB and Word.'
          action={
            <Button onClick={create.createBook}>
              <Plus /> Start a book
            </Button>
          }
        />
      ) : (
        <ul className='grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5'>
          {books.map((book) => (
            <li key={book.id}>
              <Link
                to='/app/books/$bookId'
                params={{ bookId: book.id }}
                className='group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-canvas'
              >
                <BookCover
                  title={book.title}
                  image={book.coverImage}
                  className='w-full text-[17px] transition-[translate,box-shadow] duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_12px_28px_-10px_rgb(0_0_0/0.45)]'
                />
                <p className='mt-3 truncate font-medium text-[14.5px] text-foreground'>
                  {book.title || 'Untitled book'}
                </p>
                <p className='mt-0.5 text-[12.5px] text-muted-foreground tabular-nums'>
                  {book.chapters} {book.chapters === 1 ? 'chapter' : 'chapters'} ·{' '}
                  {formatNumber(book.words)} words
                </p>
                {book.wordTarget ? (
                  <Progress
                    value={book.words / book.wordTarget}
                    className='mt-2'
                    label='Progress to target'
                  />
                ) : (
                  <p className='mt-0.5 text-[12px] text-muted-foreground'>
                    Edited {relativeTime(book.updatedAt)}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
