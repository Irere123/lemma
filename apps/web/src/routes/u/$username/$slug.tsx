import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'

import { ArticleContent } from '@/components/profile/article-content'
import { Comments, LikeButton } from '@/components/profile/article-engagement'
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

  const { data: post, isLoading, isError } = useQuery(
    trpc.documents.getPublishedBySlug.queryOptions({ slug }, { retry: false })
  )

  if (isLoading) {
    return (
      <main className='mx-auto w-full max-w-[900px] space-y-4 px-4 pt-10 md:px-6'>
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

  return (
    <main className='min-h-screen pb-24'>
      <div className='mx-auto w-full max-w-[900px] px-4 pt-10 md:px-6'>
        <Link
          to='/u/$username'
          params={{ username }}
          className='text-muted-foreground text-sm hover:text-foreground'
        >
          ← Back to @{username}
        </Link>

        {post.bannerImage && (
          <img
            src={post.bannerImage}
            alt={post.title ?? 'Cover'}
            className='mt-6 h-64 w-full rounded-xl border border-border/70 object-cover'
          />
        )}

        <h1 className='mt-6 font-semibold text-4xl leading-[1.1] tracking-tight md:text-5xl'>
          {post.title || 'Untitled'}
        </h1>
        {post.subtitle && (
          <p className='mt-3 text-lg text-muted-foreground leading-7'>{post.subtitle}</p>
        )}

        <div className='mt-6 flex items-center gap-3 border-border/60 border-b pb-6'>
          {author && (
            <Link to='/u/$username' params={{ username }} className='flex items-center gap-3'>
              <Avatar className='size-9'>
                <AvatarImage src={author.image ?? undefined} alt={author.name ?? ''} />
                <AvatarFallback>{(author.name ?? '?').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className='text-sm'>
                <p className='font-medium'>{author.name}</p>
                <p className='text-muted-foreground text-xs'>
                  {formatDate(post.publishedDate)}
                  {post.readingTime ? ` · ${post.readingTime}` : ''}
                </p>
              </div>
            </Link>
          )}
        </div>
      </div>

      <article className='mt-8'>
        <ArticleContent markdown={post.markdown ?? ''} />
      </article>

      <div className='mx-auto mt-10 w-full max-w-[900px] px-4 md:px-6'>
        <LikeButton documentId={post.id} />
      </div>

      <div className='mt-10'>
        <Comments documentId={post.id} />
      </div>
    </main>
  )
}
