import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfilePosts } from '@/components/profile/profile-posts'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/lib/auth-client'
import { buildSeoHead } from '@/lib/seo'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/u/$username/')({
  head: ({ params }) =>
    buildSeoHead({
      title: `@${params.username}`,
      description: `Posts and writing by @${params.username} on Lemma.`,
      canonicalPath: `/u/${params.username}`,
      type: 'website',
    }),
  component: RouteComponent,
})

function NotFound() {
  return (
    <div className='space-y-1 text-center'>
      <h1 className='font-semibold text-2xl'>Profile not found</h1>
      <p className='text-muted-foreground text-sm'>This handle doesn’t exist (yet).</p>
    </div>
  )
}

function RouteComponent() {
  const { username } = Route.useParams()
  const trpc = useTRPC()
  const { data: session } = useSession()

  const { data: profile, isLoading, isError } = useQuery(
    trpc.profile.getByUsername.queryOptions({ username }, { retry: false })
  )

  if (isLoading) {
    return (
      <main className='mx-auto w-full max-w-md space-y-4 px-6 py-10'>
        <Skeleton className='size-20 rounded-full' />
        <Skeleton className='h-6 w-40' />
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-2/3' />
      </main>
    )
  }

  if (isError || !profile) {
    return <main className='grid min-h-screen place-items-center px-6'><NotFound /></main>
  }

  const isOwnProfile = session?.user?.id === profile.id

  return (
    <main className='flex min-h-screen w-full flex-col md:flex-row'>
      <aside className='shrink-0 border-border/70 border-b md:sticky md:top-0 md:h-screen md:w-80 md:overflow-y-auto md:border-r md:border-b-0 lg:w-[360px]'>
        <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} />
      </aside>
      <div className='min-w-0 flex-1'>
        <ProfilePosts username={username} />
      </div>
    </main>
  )
}
