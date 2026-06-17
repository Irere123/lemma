import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { IconHeart } from '@tabler/icons-react'

import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'
import { useTRPC } from '@/trpc/client'

type ProfilePost = {
  id: string
  slug: string | null
  title: string | null
  subtitle: string | null
  publishedDate: Date | null
  readingTime: string | null
  likeCount: number
}

function formatDate(date: Date | null) {
  if (!date) return ''
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function PostList({ username, sort }: { username: string; sort: 'latest' | 'popular' }) {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.profile.posts.queryOptions({ username, sort }))

  if (isLoading) {
    return (
      <div className='mx-auto w-full max-w-2xl divide-y divide-border/60'>
        {[0, 1, 2].map((i) => (
          <div key={i} className='space-y-2 px-6 py-7'>
            <Skeleton className='h-6 w-3/4' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-3 w-24' />
          </div>
        ))}
      </div>
    )
  }

  const posts = (data ?? []) as ProfilePost[]

  if (posts.length === 0) {
    return (
      <p className='px-6 py-20 text-center text-muted-foreground text-sm'>No posts yet.</p>
    )
  }

  return (
    <ul className='mx-auto w-full max-w-2xl divide-y divide-border/60'>
      {posts.map((post) => (
        <li key={post.id}>
          <Link
            to='/u/$username/$slug'
            params={{ username, slug: post.slug ?? post.id }}
            className='group block px-6 py-7 transition-colors hover:bg-muted/30'
          >
            <h3 className='font-semibold text-lg leading-snug tracking-tight'>
              {post.title || 'Untitled'}
            </h3>
            {post.subtitle && (
              <p className='mt-1.5 line-clamp-2 text-muted-foreground leading-relaxed'>
                {post.subtitle}
              </p>
            )}
            <div className='mt-3 flex items-center gap-2 text-muted-foreground text-xs'>
              <span>{formatDate(post.publishedDate)}</span>
              {post.readingTime && (
                <>
                  <span aria-hidden>·</span>
                  <span>{post.readingTime}</span>
                </>
              )}
              {post.likeCount > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span className='flex items-center gap-1'>
                    <IconHeart className='size-3.5' /> {post.likeCount}
                  </span>
                </>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function ProfilePosts({ username }: { username: string }) {
  return (
    <Tabs defaultValue='latest' className='gap-0'>
      <div className='sticky top-0 z-10 border-border/70 border-b bg-background/80 backdrop-blur'>
        <div className='mx-auto w-full max-w-2xl px-4'>
          <TabsList variant='underline'>
            <TabsTab value='latest'>Latest</TabsTab>
            <TabsTab value='popular'>Popular</TabsTab>
          </TabsList>
        </div>
      </div>
      <TabsPanel value='latest'>
        <PostList username={username} sort='latest' />
      </TabsPanel>
      <TabsPanel value='popular'>
        <PostList username={username} sort='popular' />
      </TabsPanel>
    </Tabs>
  )
}
