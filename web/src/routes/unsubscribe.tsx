import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { IconMail, IconCheck, IconX, IconLoader } from '@tabler/icons-react'

import { ProfileHeader } from '@/components/landing'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/unsubscribe')({
  component: RouteComponent,
  head: () => {
    return { meta: [{ title: 'Unsubscribe - Newsletter' }] }
  },
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: (search.token as string) || '',
    }
  },
})

function RouteComponent() {
  const trpc = useTRPC()
  const navigate = useNavigate()
  const { token } = Route.useSearch()
  const [isAutoUnsubscribe, setIsAutoUnsubscribe] = useState(!!token)

  const {
    mutate: unsubscribe,
    isPending,
    isSuccess,
    isError,
    error,
  } = useMutation({
    ...trpc.newsletter.unsubscribe.mutationOptions(),
  })

  useEffect(() => {
    if (token && isAutoUnsubscribe) {
      // Automatically unsubscribe if token is present
      unsubscribe({ token })
      setIsAutoUnsubscribe(false)
    }
  }, [token, unsubscribe, isAutoUnsubscribe])

  const handleManualUnsubscribe = () => {
    if (token) {
      unsubscribe({ token })
    }
  }

  return (
    <main className='mx-auto max-w-3xl px-6 py-10'>
      <ProfileHeader
        title='Unsubscribe'
        current='Unsubscribe'
        links={[
          { label: 'About', to: '/' },
          { label: 'Blog', to: '/posts' },
          { label: 'Newsletter', to: '/newsletter' },
          { label: 'GitHub', href: 'https://github.com/irere123' },
        ]}
      />

      <section className='space-y-6'>
        <div className='space-y-4'>
          <h2 className='text-2xl font-bold text-gray-900'>Unsubscribe from Newsletter</h2>
          <p className='text-[15px] leading-7 text-neutral-800'>
            We're sorry to see you go. You can unsubscribe from our newsletter at any time.
          </p>
        </div>

        <div className='p-6 bg-white rounded-lg shadow-md border border-gray-200'>
          {isPending && (
            <div className='flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-md'>
              <IconLoader className='w-5 h-5 text-blue-600 animate-spin' />
              <p className='text-sm text-blue-900'>Unsubscribing you from the newsletter...</p>
            </div>
          )}

          {isSuccess && (
            <div className='space-y-4'>
              <div className='flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-md'>
                <IconCheck className='w-5 h-5 text-green-600 mt-0.5' />
                <div className='flex-1'>
                  <p className='text-sm font-medium text-green-900'>Successfully Unsubscribed</p>
                  <p className='text-xs text-green-700 mt-1'>
                    You have been removed from our mailing list. You will no longer receive
                    newsletter emails from us.
                  </p>
                </div>
              </div>

              <div className='space-y-3'>
                <p className='text-sm text-gray-700'>
                  Changed your mind? You can always{' '}
                  <button
                    onClick={() => navigate({ to: '/newsletter' })}
                    className='text-purple-600 hover:text-purple-700 underline'
                  >
                    subscribe again
                  </button>
                  .
                </p>
              </div>
            </div>
          )}

          {isError && (
            <div className='space-y-4'>
              <div className='flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-md'>
                <IconX className='w-5 h-5 text-red-600 mt-0.5' />
                <div className='flex-1'>
                  <p className='text-sm font-medium text-red-900'>Unsubscribe Failed</p>
                  <p className='text-xs text-red-700 mt-1'>
                    {(error as any)?.message || 'Something went wrong. Please try again.'}
                  </p>
                </div>
              </div>

              {token && (
                <button
                  onClick={handleManualUnsubscribe}
                  className='w-full px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500'
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          {!isPending && !isSuccess && !isError && token && (
            <div className='space-y-4'>
              <div className='flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-md'>
                <IconMail className='w-5 h-5 text-amber-600 mt-0.5' />
                <div className='flex-1'>
                  <p className='text-sm font-medium text-amber-900'>Confirm Unsubscribe</p>
                  <p className='text-xs text-amber-700 mt-1'>
                    Are you sure you want to unsubscribe from our newsletter?
                  </p>
                </div>
              </div>

              <button
                onClick={handleManualUnsubscribe}
                className='w-full px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500'
              >
                Confirm Unsubscribe
              </button>
            </div>
          )}

          {!token && !isPending && !isSuccess && (
            <div className='space-y-4'>
              <div className='flex items-start gap-3 p-4 bg-gray-50 border border-gray-200 rounded-md'>
                <IconX className='w-5 h-5 text-gray-600 mt-0.5' />
                <div className='flex-1'>
                  <p className='text-sm font-medium text-gray-900'>No Unsubscribe Token</p>
                  <p className='text-xs text-gray-700 mt-1'>
                    Please use the unsubscribe link from your newsletter email.
                  </p>
                </div>
              </div>

              <p className='text-sm text-gray-600'>
                If you're having trouble unsubscribing, please contact us directly.
              </p>
            </div>
          )}
        </div>

        <div className='space-y-3 pt-4'>
          <h3 className='text-lg font-semibold text-gray-900'>Why unsubscribe?</h3>
          <p className='text-sm text-neutral-700'>
            We understand that your inbox is precious. If our content wasn't what you expected or if
            you're receiving too many emails, we'd love to hear your feedback to improve our
            newsletter.
          </p>
          <p className='text-sm text-neutral-700'>
            You can always resubscribe later if you change your mind!
          </p>
        </div>
      </section>
    </main>
  )
}
