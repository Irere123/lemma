import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'

import { ArticleBody } from '@/components/profile/article-content'
import { ArticleStats, Comments, LikeButton } from '@/components/profile/article-engagement'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { buildSeoHead } from '@/lib/seo'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/u/$username/$slug')({
  head: ({ params }) =>
    buildSeoHead({
      title: params.slug.replace(/-/g, ' '),
      canonicalPath: `/u/${params.username}/${params.slug}`,
      type: 'article',
    }),
  component: RouteComponent,
})

function formatDate(date: Date | null | undefined) {
  if (!date) return ''
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function RouteComponent() {
  const { username, slug } = Route.useParams()
  const trpc = useTRPC()

  const {
    data: post,
    isLoading,
    isError,
  } = useQuery(trpc.documents.getPublishedBySlug.queryOptions({ slug }, { retry: false }))

  if (isLoading) {
    return (
      <main className='mx-auto w-full max-w-[calc(var(--writer-measure)+2.5rem)] space-y-4 px-5 pt-12'>
        <Skeleton className='h-10 w-3/4' />
        <Skeleton className='h-5 w-1/2' />
        <Skeleton className='h-64 w-full rounded-xl' />
      </main>
    )
  }

  if (isError || !post) {
    return (
      <main className='grid min-h-screen place-items-center px-6'>
        <div className='space-y-1 text-center'>
          <h1 className='font-semibold text-2xl'>Post not found</h1>
          <p className='text-muted-foreground text-sm'>It may be unpublished or moved.</p>
        </div>
      </main>
    )
  }

  const author = post.author
  const chapter = post.chapter

  return (
    <main className='min-h-screen pb-24'>
      <div className='mx-auto w-full max-w-[calc(var(--writer-measure)+2.5rem)] px-5 pt-12'>
        {chapter?.book.published && chapter.book.slug ? (
          <Link
            to='/u/$username/b/$bookSlug'
            params={{ username, bookSlug: chapter.book.slug }}
            className='inline-flex text-muted-foreground text-sm transition-colors hover:text-foreground'
          >
            ← {chapter.book.title || 'Book'}
          </Link>
        ) : (
          <Link
            to='/u/$username'
            params={{ username }}
            className='inline-flex text-muted-foreground text-sm transition-colors hover:text-foreground'
          >
            ← Back to @{username}
          </Link>
        )}

        {chapter ? (
          <p className='mt-8 font-medium text-[13px] text-muted-foreground uppercase tracking-[0.12em]'>
            Chapter {chapter.number}
            {chapter.book.title ? ` · ${chapter.book.title}` : ''}
          </p>
        ) : null}
        <h1
          className={`${chapter ? 'mt-3' : 'mt-8'} text-balance font-semibold text-4xl leading-[1.08] tracking-tight md:text-[2.85rem]`}
        >
          {post.title || 'Untitled'}
        </h1>
        {post.subtitle && (
          <p className='mt-4 text-pretty text-muted-foreground text-xl leading-8'>
            {post.subtitle}
          </p>
        )}

        <div className='mt-7 flex items-center justify-between gap-4 border-border/60 border-b pb-7'>
          {author && (
            <Link
              to='/u/$username'
              params={{ username }}
              className='group flex min-w-0 items-center gap-3'
            >
              <Avatar className='size-10 shrink-0'>
                <AvatarImage src={author.image ?? undefined} alt={author.name ?? ''} />
                <AvatarFallback>{(author.name ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className='min-w-0 text-sm leading-tight'>
                <p className='truncate font-medium group-hover:underline'>{author.name}</p>
                <p className='mt-0.5 text-muted-foreground text-xs'>
                  {[formatDate(post.publishedDate ?? post.firstPublishedAt), post.readingTime]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </Link>
          )}
          <ArticleStats documentId={post.id} />
        </div>

        {post.bannerImage && (
          <img
            src={post.bannerImage}
            alt={post.title ?? 'Cover'}
            className='mt-8 aspect-[16/9] w-full rounded-xl border border-border/70 object-cover'
          />
        )}
      </div>

      <article className='mx-auto mt-10 w-full max-w-[calc(var(--writer-measure)+2.5rem)] px-5'>
        <ArticleBody html={post.html} />
      </article>

      {chapter && (chapter.previous || chapter.next) ? (
        <nav
          aria-label='Chapters'
          className='mx-auto mt-14 grid w-full max-w-[calc(var(--writer-measure)+2.5rem)] grid-cols-2 gap-3 px-5'
        >
          {chapter.previous?.slug ? (
            <Link
              to='/u/$username/$slug'
              params={{ username, slug: chapter.previous.slug }}
              className='group rounded-xl border border-border/70 px-4 py-3 transition-colors hover:bg-accent/50'
            >
              <span className='block text-[12px] text-muted-foreground'>← Previous chapter</span>
              <span className='mt-0.5 block truncate font-medium text-[15px]'>
                {chapter.previous.title || 'Untitled'}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {chapter.next?.slug ? (
            <Link
              to='/u/$username/$slug'
              params={{ username, slug: chapter.next.slug }}
              className='group rounded-xl border border-border/70 px-4 py-3 text-right transition-colors hover:bg-accent/50'
            >
              <span className='block text-[12px] text-muted-foreground'>Next chapter →</span>
              <span className='mt-0.5 block truncate font-medium text-[15px]'>
                {chapter.next.title || 'Untitled'}
              </span>
            </Link>
          ) : null}
        </nav>
      ) : null}

      <div className='mx-auto mt-12 w-full max-w-[calc(var(--writer-measure)+2.5rem)] px-5'>
        <LikeButton documentId={post.id} />
      </div>

      <div className='mt-12'>
        <Comments documentId={post.id} />
      </div>
    </main>
  )
}
