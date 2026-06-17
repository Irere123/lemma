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
      <div className='space-y-4 p-4'>
        {[0, 1, 2].map((i) => (
          <div key={i} className='space-y-2'>
            <Skeleton className='h-5 w-2/3' />
            <Skeleton className='h-4 w-full' />
          </div>
        ))}
      </div>
    )
  }

  const posts = (data ?? []) as ProfilePost[]

  if (posts.length === 0) {
    return <p className='p-8 text-center text-muted-foreground text-sm'>No posts yet.</p>
  }

  return (
    <ul className='divide-y'>
      {posts.map((post) => (
        <li key={post.id}>
          <Link
            to='/u/$username/$slug'
            params={{ username, slug: post.slug ?? post.id }}
            className='block px-4 py-4 transition-colors hover:bg-muted/40'
          >
            <h3 className='font-semibold text-base leading-snug'>{post.title || 'Untitled'}</h3>
            {post.subtitle && (
              <p className='mt-1 line-clamp-2 text-muted-foreground text-sm'>{post.subtitle}</p>
            )}
            <div className='mt-2 flex items-center gap-3 text-muted-foreground text-xs'>
              <span>{formatDate(post.publishedDate)}</span>
              {post.readingTime && <span>· {post.readingTime}</span>}
              {post.likeCount > 0 && (
                <span className='flex items-center gap-1'>
                  · <IconHeart className='size-3' /> {post.likeCount}
                </span>
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
    <Tabs defaultValue='latest'>
      <div className='border-b'>
        <TabsList variant='underline'>
          <TabsTab value='latest'>Latest</TabsTab>
          <TabsTab value='popular'>Popular</TabsTab>
        </TabsList>
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
