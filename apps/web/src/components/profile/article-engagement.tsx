import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { IconHeart, IconHeartFilled, IconLoader2, IconMessageCircle } from '@tabler/icons-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/auth-client'
import { useTRPC } from '@/trpc/client'

export function LikeButton({ documentId }: { documentId: string }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: session } = useSession()

  const statusQuery = trpc.likes.getStatus.queryOptions({ documentId })
  const { data: status } = useQuery(statusQuery)

  const toggle = useMutation(
    trpc.likes.toggle.mutationOptions({
      onSuccess: (data) => {
        // toggle returns { liked }, getStatus caches { isLiked }.
        queryClient.setQueryData(statusQuery.queryKey, {
          isLiked: data.liked,
          likeCount: data.likeCount,
        })
      },
    })
  )

  const onClick = () => {
    if (!session?.user) {
      navigate({ to: '/login' })
      return
    }
    toggle.mutate({ documentId })
  }

  const liked = status?.isLiked ?? false
  const count = status?.likeCount ?? 0

  return (
    <Button variant='outline' onClick={onClick} disabled={toggle.isPending} className='gap-2'>
      {liked ? (
        <IconHeartFilled className='size-4 text-red-500' />
      ) : (
        <IconHeart className='size-4' />
      )}
      <span className='tabular-nums'>{count}</span>
    </Button>
  )
}

/**
 * Read-only engagement summary shown in the article byline: total likes and
 * comments. Reuses the same queries as the interactive controls below, so the
 * numbers stay in sync via the shared React Query cache.
 */
export function ArticleStats({ documentId }: { documentId: string }) {
  const trpc = useTRPC()
  const { data: likeStatus } = useQuery(trpc.likes.getStatus.queryOptions({ documentId }))
  const { data: commentData } = useQuery(trpc.comments.count.queryOptions({ documentId }))

  const likes = likeStatus?.likeCount ?? 0
  const comments = commentData?.count ?? 0

  return (
    <div className='flex shrink-0 items-center gap-1 text-muted-foreground text-sm'>
      <span className='flex items-center gap-1.5 px-2 py-1'>
        <IconHeart className='size-4' />
        <span className='tabular-nums'>{likes}</span>
      </span>
      <a
        href='#comments'
        className='flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-muted hover:text-foreground'
      >
        <IconMessageCircle className='size-4' />
        <span className='tabular-nums'>{comments}</span>
      </a>
    </div>
  )
}

type CommentItem = {
  id: string
  content: string
  createdAt: Date | null
  author: { id: string; name: string | null; image: string | null }
}

function formatWhen(date: Date | null) {
  if (!date) return ''
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function Comments({ documentId }: { documentId: string }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const [content, setContent] = useState('')

  const commentsQuery = trpc.comments.getComments.queryOptions({ documentId, limit: 20 })
  const { data, isLoading } = useQuery(commentsQuery)

  const create = useMutation(
    trpc.comments.create.mutationOptions({
      onSuccess: () => {
        setContent('')
        queryClient.invalidateQueries({ queryKey: commentsQuery.queryKey })
        // Keep the byline stat in sync with the freshly posted comment.
        queryClient.invalidateQueries({ queryKey: trpc.comments.count.queryKey({ documentId }) })
      },
      onError: (err) => toast.error(err.message || 'Could not post comment'),
    })
  )

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!content.trim()) return
    create.mutate({ documentId, content: content.trim() })
  }

  const comments = (data?.comments ?? []) as CommentItem[]

  return (
    <section id='comments' className='mx-auto w-full max-w-2xl scroll-mt-8 px-5 md:px-6'>
      <h2 className='mb-4 font-semibold text-lg'>
        Comments {comments.length > 0 && <span className='text-muted-foreground'>({comments.length})</span>}
      </h2>

      {session?.user ? (
        <form onSubmit={onSubmit} className='mb-6 space-y-2'>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder='Add a comment…'
            className={cn(
              'w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs/5 outline-none placeholder:text-muted-foreground/72 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24'
            )}
          />
          <div className='flex justify-end'>
            <Button type='submit' size='sm' disabled={create.isPending || !content.trim()}>
              {create.isPending && <IconLoader2 className='size-4 animate-spin' />}
              Comment
            </Button>
          </div>
        </form>
      ) : (
        <p className='mb-6 rounded-lg border bg-muted/30 px-4 py-3 text-muted-foreground text-sm'>
          <Link to='/login' className='font-medium text-foreground underline'>
            Sign in
          </Link>{' '}
          to join the conversation.
        </p>
      )}

      {isLoading ? (
        <p className='text-muted-foreground text-sm'>Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No comments yet. Be the first.</p>
      ) : (
        <ul className='space-y-5'>
          {comments.map((comment) => (
            <li key={comment.id} className='flex gap-3'>
              <Avatar className='size-8 shrink-0'>
                <AvatarImage src={comment.author.image ?? undefined} alt={comment.author.name ?? ''} />
                <AvatarFallback>
                  {(comment.author.name ?? '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className='min-w-0'>
                <div className='flex items-center gap-2 text-sm'>
                  <span className='font-medium'>{comment.author.name ?? 'Anonymous'}</span>
                  <span className='text-muted-foreground text-xs'>{formatWhen(comment.createdAt)}</span>
                </div>
                <p className='whitespace-pre-wrap text-sm'>{comment.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
