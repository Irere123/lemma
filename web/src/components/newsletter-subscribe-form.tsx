import { useMutation } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { IconCheck, IconX } from '@tabler/icons-react'
import { useState, type FormEvent } from 'react'

import { Button } from './ui/button'
import { subscribe as subscribeNewsletter } from '@/lib/functions/subscribe'

export const NewsletterSubscribeForm = () => {
  const subscribeFn = useServerFn(subscribeNewsletter)
  const { mutate: subscribeToNewsletter, isPending: isSubscribing } = useMutation({
    mutationKey: ['subscribe'],
    mutationFn: subscribeFn,
    onSuccess: () => {
      setResult({
        type: 'success',
        message: 'Successfully subscribed! Please check your email to confirm your subscription.',
      })
      setTimeout(() => {
        setResult(null)
      }, 3000)
    },
    onError: (error: any) => {
      console.log(error.response.data)
      if (error.response.data.error) {
        setResult({
          type: 'error',
          message: error.response.data.error,
        })
      } else {
        setResult({
          type: 'error',
          message: error.message || 'Failed to subscribe. Please try again.',
        })
      }
    },
  })

  const [email, setEmail] = useState('')
  const [result, setResult] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    subscribeToNewsletter({ data: { email } })
  }

  return (
    <div className='border border-border rounded-lg bg-card'>
      <div className='h-[160px] w-full border-b border-border bg-secondary'>
        <div className='relative flex h-full w-full items-center justify-center gap-2'>
          <div className='absolute top-1/2 left-1/2 flex h-full translate-x-[-50%] translate-y-[-50%] gap-32'>
            <span className='h-full border-l border-dashed border-border'></span>
            <span className='h-full border-l border-dashed border-border'></span>
          </div>
          <div className='absolute top-1/2 left-1/2 flex w-full translate-x-[-50%] translate-y-[-50%] flex-col gap-24'>
            <span className='w-full border-t border-dashed border-border'></span>
            <span className='w-full border-b border-dashed border-border'></span>
          </div>
          <div className='shadow-bg bg-preview-bg shadow-custom flex size-14 shrink-0 items-center justify-center rounded-xl dark:border dark:border-border dark:shadow-none'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              fill='none'
              className='fill-foreground size-8 shrink-0'
            >
              <path d='M2.12015 6.20855C2.07321 6.40572 2.04691 6.60508 2.03057 6.80497C1.99997 7.17953 1.99998 7.63426 2 8.16138V15.8385C1.99998 16.3657 1.99997 16.8205 2.03057 17.195C2.06287 17.5904 2.13419 17.9836 2.32698 18.362C2.6146 18.9265 3.07355 19.3854 3.63803 19.673C4.01641 19.8658 4.40963 19.9371 4.80498 19.9694C5.17951 20 5.63422 20 6.16129 20H17.8385C18.3656 20 18.8205 20 19.195 19.9694C19.5904 19.9371 19.9836 19.8658 20.362 19.673C20.9265 19.3854 21.3854 18.9265 21.673 18.362C21.8658 17.9836 21.9371 17.5904 21.9694 17.195C22 16.8205 22 16.3657 22 15.8386V8.16144C22 7.6343 22 7.17954 21.9694 6.80497C21.9531 6.60507 21.9268 6.40572 21.8799 6.20855L13.8997 12.7378C12.7946 13.6419 11.2054 13.6419 10.1003 12.7378L2.12015 6.20855Z'></path>
              <path d='M20.7406 4.55656C20.6207 4.47119 20.4943 4.39438 20.362 4.32698C19.9836 4.13419 19.5904 4.06287 19.195 4.03057C18.8205 3.99997 18.3657 3.99998 17.8386 4H6.16146C5.63434 3.99998 5.17953 3.99997 4.80498 4.03057C4.40963 4.06287 4.01641 4.13419 3.63803 4.32698C3.50575 4.39438 3.37927 4.47119 3.25943 4.55656L11.3668 11.1898C11.7351 11.4912 12.2649 11.4912 12.6332 11.1898L20.7406 4.55656Z'></path>
            </svg>
          </div>
        </div>
      </div>
      <div className='flex w-full shrink-0 flex-col items-start justify-center p-5'>
        <h2 className='text-foreground font-medium'>Stay In The Loop</h2>
        <p className='text-muted-foreground mt-0.5'>
          Get updates when I share new posts, resources and tips.
        </p>
        <form className='mt-3 flex w-full flex-col gap-3 sm:flex-row' onSubmit={handleSubmit}>
          <label htmlFor='email' className='sr-only'>
            Email address
          </label>
          <input
            id='email'
            type='email'
            inputMode='email'
            autoComplete='email'
            required
            className='text-foreground bg-background h-10 shrink-0 grow-1 rounded-lg border px-4 outline-none placeholder:text-muted-foreground border-input focus:border-ring transition-colors duration-200 ease-out'
            placeholder='your@email.com'
            name='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubscribing}
          />
          <Button
            className='bg-primary text-primary-foreground hover:bg-primary/90'
            disabled={isSubscribing}
          >
            <span style={{ willChange: 'transform', transform: 'none' }}>
              {isSubscribing ? 'Subscribing...' : 'Subscribe'}
            </span>
          </Button>
        </form>

        {result && (
          <div
            className={`mt-3 flex items-start gap-2 p-3 rounded-lg ${
              result.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {result.type === 'success' ? (
              <IconCheck className='w-5 h-5 text-green-600 mt-0.5 flex-shrink-0' />
            ) : (
              <IconX className='w-5 h-5 text-red-600 mt-0.5 flex-shrink-0' />
            )}
            <p
              className={`text-sm ${result.type === 'success' ? 'text-green-900' : 'text-red-900'}`}
            >
              {result.message}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
