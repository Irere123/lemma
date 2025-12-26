import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { useSession } from '@/lib/auth-client'

export const Route = createFileRoute('/_write')({
  component: WriteLayout,
})

function WriteLayout() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (!session?.user && !isPending) {
      navigate({ to: '/login' })
    }
  }, [session, isPending, navigate])

  if (isPending) {
    return (
      <div className='min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center'>
        <div className='animate-pulse text-zinc-400'>Loading...</div>
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  return <Outlet />
}
