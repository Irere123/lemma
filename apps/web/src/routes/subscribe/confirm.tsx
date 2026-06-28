import { IconCheck, IconLoader2, IconX } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { buildSeoHead } from '@/lib/seo'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/subscribe/confirm')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  head: () =>
    buildSeoHead({
      title: 'Confirm your subscription',
      canonicalPath: '/subscribe/confirm',
      noIndex: true,
      type: 'website',
    }),
  component: RouteComponent,
})

function RouteComponent() {
  const { token } = Route.useSearch()
  const trpc = useTRPC()
  const confirm = useMutation(trpc.newsletter.confirmation.mutationOptions())
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current || !token) return
    firedRef.current = true
    confirm.mutate({ token })
  }, [token, confirm])

  const state = !token
    ? 'invalid'
    : confirm.isPending || confirm.isIdle
      ? 'loading'
      : confirm.isError
        ? 'error'
        : 'success'

  return (
    <main className='grid min-h-screen place-items-center px-6'>
      <div className='w-full max-w-md rounded-2xl border bg-card p-8 text-center'>
        {state === 'loading' && (
          <>
            <IconLoader2 className='mx-auto size-8 animate-spin text-muted-foreground' />
            <h1 className='mt-4 font-semibold text-xl'>Confirming your subscription…</h1>
          </>
        )}

        {state === 'success' && (
          <>
            <div className='mx-auto grid size-12 place-items-center rounded-full bg-success/12 text-success'>
              <IconCheck className='size-6' />
            </div>
            <h1 className='mt-4 font-semibold text-xl'>You're subscribed!</h1>
            <p className='mt-2 text-muted-foreground text-sm'>
              Your subscription is confirmed. New posts will land in your inbox.
            </p>
          </>
        )}

        {state === 'error' && (
          <>
            <div className='mx-auto grid size-12 place-items-center rounded-full bg-destructive/12 text-destructive'>
              <IconX className='size-6' />
            </div>
            <h1 className='mt-4 font-semibold text-xl'>Couldn't confirm</h1>
            <p className='mt-2 text-muted-foreground text-sm'>
              {confirm.error?.message || 'This confirmation link is invalid or has expired.'}
            </p>
          </>
        )}

        {state === 'invalid' && (
          <>
            <div className='mx-auto grid size-12 place-items-center rounded-full bg-destructive/12 text-destructive'>
              <IconX className='size-6' />
            </div>
            <h1 className='mt-4 font-semibold text-xl'>Missing confirmation token</h1>
            <p className='mt-2 text-muted-foreground text-sm'>
              This link is incomplete. Try the link from your email again.
            </p>
          </>
        )}

        <Button variant='outline' className='mt-6' render={<Link to='/'>Back to Lemma</Link>} />
      </div>
    </main>
  )
}
