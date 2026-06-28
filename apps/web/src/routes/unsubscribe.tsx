import { IconCheck, IconLoader2, IconX } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import { buildSeoHead } from '@/lib/seo'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/unsubscribe')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  head: () =>
    buildSeoHead({
      title: 'Unsubscribe',
      canonicalPath: '/unsubscribe',
      noIndex: true,
      type: 'website',
    }),
  component: RouteComponent,
})

function RouteComponent() {
  const { token } = Route.useSearch()
  const trpc = useTRPC()
  const [reason, setReason] = useState('')

  const unsubscribe = useMutation(trpc.newsletter.unsubscribe.mutationOptions())

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return
    unsubscribe.mutate({ token, reason: reason.trim() || undefined })
  }

  return (
    <main className='grid min-h-screen place-items-center px-6'>
      <div className='w-full max-w-md rounded-2xl border bg-card p-8 text-center'>
        {!token ? (
          <>
            <div className='mx-auto grid size-12 place-items-center rounded-full bg-destructive/12 text-destructive'>
              <IconX className='size-6' />
            </div>
            <h1 className='mt-4 font-semibold text-xl'>Invalid unsubscribe link</h1>
            <p className='mt-2 text-muted-foreground text-sm'>
              This link is incomplete. Use the unsubscribe link from your email.
            </p>
          </>
        ) : unsubscribe.isSuccess ? (
          <>
            <div className='mx-auto grid size-12 place-items-center rounded-full bg-success/12 text-success'>
              <IconCheck className='size-6' />
            </div>
            <h1 className='mt-4 font-semibold text-xl'>You've unsubscribed</h1>
            <p className='mt-2 text-muted-foreground text-sm'>
              You won't receive any more emails from this newsletter. Sorry to see you go.
            </p>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <h1 className='font-semibold text-xl'>Unsubscribe?</h1>
            <p className='mt-2 text-muted-foreground text-sm'>
              You'll stop receiving emails from this newsletter. You can resubscribe anytime.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder='Optional: tell the author why you’re leaving'
              className='mt-4 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-left text-sm text-foreground shadow-xs/5 outline-none placeholder:text-muted-foreground/72 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24'
            />
            {unsubscribe.isError && (
              <p className='mt-3 text-destructive text-sm'>
                {unsubscribe.error?.message || 'Could not unsubscribe. The link may have expired.'}
              </p>
            )}
            <Button
              type='submit'
              variant='destructive'
              className='mt-4 w-full'
              disabled={unsubscribe.isPending}
            >
              {unsubscribe.isPending && <IconLoader2 className='size-4 animate-spin' />}
              Unsubscribe
            </Button>
          </form>
        )}

        <Button variant='ghost' className='mt-4' render={<Link to='/'>Back to Lemma</Link>} />
      </div>
    </main>
  )
}
