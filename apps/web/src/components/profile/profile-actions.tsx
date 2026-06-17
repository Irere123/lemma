import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { IconCheck, IconLink, IconLoader2, IconMail } from '@tabler/icons-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import { useCopyToClipboard } from '@/hooks/use-copy-clipboard'
import { useSession } from '@/lib/auth-client'
import { useTRPC } from '@/trpc/client'

export function FollowButton({
  userId,
  username,
  initialIsFollowing,
  initialFollowerCount,
}: {
  userId: string
  username: string
  initialIsFollowing: boolean
  initialFollowerCount: number
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: session, isPending } = useSession()

  const statusQuery = trpc.follows.status.queryOptions(
    { userId },
    { initialData: { isFollowing: initialIsFollowing, followerCount: initialFollowerCount } }
  )
  const { data: status } = useQuery(statusQuery)

  const invalidateProfile = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.profile.getByUsername.queryOptions({ username }).queryKey,
    })

  const follow = useMutation(
    trpc.follows.follow.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(statusQuery.queryKey, data)
        void invalidateProfile()
      },
    })
  )
  const unfollow = useMutation(
    trpc.follows.unfollow.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(statusQuery.queryKey, data)
        void invalidateProfile()
      },
    })
  )

  const pending = follow.isPending || unfollow.isPending
  const isFollowing = status?.isFollowing ?? false

  const onClick = () => {
    if (!session?.user) {
      navigate({ to: '/login' })
      return
    }
    if (isFollowing) {
      unfollow.mutate({ userId })
    } else {
      follow.mutate({ userId })
    }
  }

  return (
    <Button
      variant={isFollowing ? 'outline' : 'default'}
      onClick={onClick}
      disabled={pending || isPending}
      className='min-w-28'
    >
      {pending ? (
        <IconLoader2 className='size-4 animate-spin' />
      ) : isFollowing ? (
        <>
          <IconCheck className='size-4' /> Following
        </>
      ) : (
        'Follow'
      )}
    </Button>
  )
}

export function SubscribeButton({ username }: { username: string }) {
  const trpc = useTRPC()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')

  const subscribe = useMutation(
    trpc.newsletter.subscribePublic.mutationOptions({
      onSuccess: (res) => {
        toast.success(res.message || 'Subscribed — check your inbox to confirm.')
        setOpen(false)
        setEmail('')
      },
      onError: (err) => {
        toast.error(err.message || 'Could not subscribe right now.')
      },
    })
  )

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim()) return
    subscribe.mutate({ username, email: email.trim() })
  }

  return (
    <>
      <Button variant='secondary' onClick={() => setOpen(true)}>
        <IconMail className='size-4' /> Subscribe
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Subscribe to @{username}</DialogTitle>
            <DialogDescription>
              Get new posts delivered to your inbox. You can unsubscribe anytime.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit}>
            <DialogPanel className='space-y-3'>
              <Input
                type='email'
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='you@example.com'
                size='lg'
              />
            </DialogPanel>
            <DialogFooter>
              <Button type='submit' disabled={subscribe.isPending}>
                {subscribe.isPending && <IconLoader2 className='size-4 animate-spin' />}
                Subscribe
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </>
  )
}

export function ShareButton({ username }: { username: string }) {
  const [, copy] = useCopyToClipboard()
  const [copied, setCopied] = useState(false)

  const onClick = async () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/u/${username}`
        : `/u/${username}`
    const ok = await copy(url)
    if (ok) {
      setCopied(true)
      toast.success('Profile link copied')
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <Button variant='ghost' size='icon' onClick={onClick} aria-label='Copy profile link'>
      {copied ? <IconCheck className='size-4' /> : <IconLink className='size-4' />}
    </Button>
  )
}
