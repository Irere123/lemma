import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { BookCover } from '@/components/workspace/book-cover'
import { formatNumber } from '@/lib/format'
import { buildSeoHead } from '@/lib/seo'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/u/$username/b/$bookSlug')({
  head: ({ params }) =>
    buildSeoHead({
      title: params.bookSlug.replace(/-/g, ' '),
      canonicalPath: `/u/${params.username}/b/${params.bookSlug}`,
      type: 'website',
    }),
  component: BookPage,
})

/** A published book: its cover and description, and its published chapters to read. */
function BookPage() {
  const { username, bookSlug } = Route.useParams()
  const trpc = useTRPC()
  const { data: book, isLoading } = useQuery(
    trpc.books.getPublished.queryOptions({ username, slug: bookSlug }, { retry: false })
  )

  if (isLoading) {
    return (
      <main className='mx-auto flex w-full max-w-3xl gap-8 px-5 pt-16'>
        <Skeleton className='aspect-[2/3] w-40 rounded-md' />
        <div className='flex-1 space-y-3'>
          <Skeleton className='h-10 w-3/4' />
          <Skeleton className='h-5 w-1/2' />
        </div>
      </main>
    )
  }
  if (!book) {
    return (
      <main className='grid min-h-screen place-items-center px-6'>
        <div className='space-y-1 text-center'>
          <h1 className='font-semibold text-2xl'>Book not found</h1>
          <p className='text-muted-foreground text-sm'>It may be private or moved.</p>
        </div>
      </main>
    )
  }

  const chapters = book.entries.filter((entry) => entry.kind === 'chapter')
  const first = chapters[0]
  const words = chapters.reduce((sum, chapter) => sum + (Number(chapter.wordCount) || 0), 0)
  let number = 0

  return (
    <main className='min-h-screen pb-24'>
      <div className='mx-auto w-full max-w-3xl px-5 pt-12'>
        <Link
          to='/u/$username'
          params={{ username }}
          className='text-muted-foreground text-sm hover:text-foreground'
        >
          ← @{username}
        </Link>
        <header className='mt-10 flex flex-col gap-8 sm:flex-row sm:items-end'>
          <BookCover
            title={book.title}
            image={book.coverImage}
            className='w-40 text-[19px] shadow-[0_18px_40px_-18px_rgb(0_0_0/0.55)] sm:w-48'
          />
          <div className='min-w-0 pb-1'>
            <h1 className='text-balance font-semibold text-4xl leading-[1.08] tracking-tight'>
              {book.title}
            </h1>
            {book.subtitle ? (
              <p className='mt-3 font-serif text-muted-foreground text-xl'>{book.subtitle}</p>
            ) : null}
            <div className='mt-5 flex items-center gap-2.5'>
              <Avatar className='size-8'>
                <AvatarImage src={book.author.image ?? undefined} alt='' />
                <AvatarFallback>{book.author.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className='text-sm'>
                <span className='font-medium'>{book.author.name}</span>
                <span className='text-muted-foreground'>
                  {' '}
                  · {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'} ·{' '}
                  {formatNumber(words)} words
                </span>
              </span>
            </div>
            {first?.slug ? (
              <Link
                to='/u/$username/$slug'
                params={{ username, slug: first.slug }}
                className='mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-4 font-medium text-[14px] text-primary-foreground shadow-xs transition-[filter] hover:brightness-110'
              >
                Start reading
              </Link>
            ) : null}
          </div>
        </header>

        {book.description ? (
          <p className='mt-10 whitespace-pre-line font-serif text-[1.12rem] text-foreground/90 leading-relaxed'>
            {book.description}
          </p>
        ) : null}

        <section className='mt-12'>
          <h2 className='mb-3 font-medium text-[13px] text-muted-foreground uppercase tracking-[0.08em]'>
            Contents
          </h2>
          <ol className='flex flex-col divide-y divide-border/60 border-border/60 border-y'>
            {book.entries.map((entry) => {
              if (entry.kind === 'part') {
                return (
                  <li key={entry.id} className='pt-6 pb-2 font-semibold text-[15px]'>
                    {entry.title}
                  </li>
                )
              }
              number++
              return (
                <li key={entry.id}>
                  <Link
                    to='/u/$username/$slug'
                    params={{ username, slug: entry.slug ?? entry.id }}
                    className='flex items-baseline gap-4 py-3.5 transition-colors hover:text-brand'
                  >
                    <span className='w-6 shrink-0 text-right font-serif text-muted-foreground tabular-nums'>
                      {number}
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span className='block font-medium text-[16px]'>
                        {entry.title || 'Untitled'}
                      </span>
                      {entry.excerpt ? (
                        <span className='mt-0.5 block line-clamp-1 text-[14px] text-muted-foreground'>
                          {entry.excerpt}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </main>
  )
}
