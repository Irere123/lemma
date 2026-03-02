import { IconLoader2 } from '@tabler/icons-react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { Google } from '@/components/svgs'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { getSession } from '@/lib/auth.server'
import { buildSeoHead } from '@/lib/seo'

export const Route = createFileRoute('/login')({
  component: RouteComponent,
  head: () =>
    buildSeoHead({
      canonicalPath: '/login',
      description: 'Sign in to Lemma to continue writing and publishing programmable knowledge.',
      noIndex: true,
      title: 'Login',
      type: 'website',
    }),
  beforeLoad: async () => {
    const session = await getSession()
    if (session?.data?.user) {
      throw redirect({ to: '/app' })
    }
    return null
  },
})

function RouteComponent() {
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${import.meta.env.VITE_PUBLIC_APP_URL}/app`,
      })
    } catch {
      toast.error('Failed to sign in with Google')
      setIsLoading(false)
    }
  }

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-background to-muted/30 p-4'>
      <div className='w-full max-w-sm space-y-8'>
        <div className='text-center'>
          <h1 className='font-bold text-3xl tracking-tight'>Lemma</h1>
          <p className='mt-2 text-muted-foreground text-sm'>
            Sign in to continue to your publishing room.
          </p>
        </div>

        <div className='p-6'>
          <div className='space-y-4'>
            <Button
              variant='outline'
              className='h-11 w-full gap-3'
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <IconLoader2 className='animate-spin' size={18} />
              ) : (
                <Google className='size-4' />
              )}
              Continue with Google
            </Button>
          </div>
        </div>

        <p className='text-center text-muted-foreground text-xs'>
          By continuing, you agree to our{' '}
          <Link to='/' className='underline'>
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to='/' className='underline'>
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}
