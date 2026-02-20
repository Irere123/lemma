import {
  IconApps,
  IconExternalLink,
  IconPlus,
  IconShieldCheck,
  IconTrash,
} from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

import { DeleteOAuthAppModal } from '@/components/modals/delete-oauth-app-modal'
import { OAuthAppModal } from '@/components/modals/oauth-app-modal'
import { OAuthAppsTable } from '@/components/tables/oauth-apps'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOAuthAppsModalStore } from '@/stores/oauth-apps-modal'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/app/settings/apps')({
  component: RouteComponent,
})

function RouteComponent() {
  const { setData } = useOAuthAppsModalStore()

  return (
    <section className='space-y-8'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10'>
            <IconApps className='text-primary' size={20} />
          </div>
          <div>
            <h3 className='font-semibold text-xl tracking-tight'>OAuth Applications</h3>
            <p className='text-muted-foreground text-sm'>
              Manage your OAuth apps and authorized integrations.
            </p>
          </div>
        </div>
        <Button onClick={() => setData(undefined, 'create')}>
          <IconPlus size={16} />
          Create Application
        </Button>
      </div>

      <Tabs defaultValue='my-apps'>
        <TabsList>
          <TabsTrigger value='my-apps'>My Applications</TabsTrigger>
          <TabsTrigger value='authorized'>Authorized Apps</TabsTrigger>
        </TabsList>

        <TabsContent value='my-apps' className='mt-6 space-y-4'>
          <div className='rounded-lg border bg-muted/30 p-4'>
            <h4 className='mb-1 font-medium'>Build integrations with Lemma</h4>
            <p className='text-muted-foreground text-sm'>
              Create OAuth applications to let users connect their Lemma account to your service.
            </p>
          </div>
          <OAuthAppsTable />
        </TabsContent>

        <TabsContent value='authorized' className='mt-6'>
          <AuthorizedAppsSection />
        </TabsContent>
      </Tabs>

      <OAuthAppModal />
      <DeleteOAuthAppModal />
    </section>
  )
}

function AuthorizedAppsSection() {
  return (
    <div className='space-y-4'>
      <div className='rounded-lg border bg-muted/30 p-4'>
        <h4 className='mb-1 font-medium'>Apps with access to your account</h4>
        <p className='text-muted-foreground text-sm'>
          Third-party apps that can access your Lemma account. You can revoke access at any time.
        </p>
      </div>
      <AuthorizedAppsList />
    </div>
  )
}

function AuthorizedAppsList() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery(trpc.oauthApplications.authorized.queryOptions())
  type AuthorizedApp = NonNullable<typeof data>['data'][number]

  const revokeMutation = useMutation(
    trpc.oauthApplications.revokeAccess.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [['oauthApplications', 'authorized']] })
        toast.success('Access revoked successfully')
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to revoke access')
      },
    })
  )

  if (isLoading) {
    return (
      <div className='space-y-3'>
        <Skeleton className='h-20 w-full' />
        <Skeleton className='h-20 w-full' />
      </div>
    )
  }

  const apps = (data?.data ?? []).filter(
    (
      app
    ): app is AuthorizedApp & {
      id: string
      name: string
    } => typeof app.id === 'string' && typeof app.name === 'string'
  )

  if (apps.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center rounded-lg border border-dashed py-12'>
        <IconShieldCheck className='mb-4 text-muted-foreground' size={40} />
        <h4 className='mb-1 font-semibold'>No Authorized Applications</h4>
        <p className='text-muted-foreground text-sm'>
          You haven&apos;t authorized any third-party applications yet.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      {apps.map((app) => (
        <div key={app.id} className='flex items-center justify-between rounded-lg border p-4'>
          <div className='flex items-center gap-3'>
            {app.logoUrl ? (
              <img
                src={app.logoUrl ?? undefined}
                alt={app.name}
                className='h-10 w-10 rounded-lg object-cover'
              />
            ) : (
              <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-muted'>
                <span className='font-medium text-sm'>{app.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div>
              <div className='flex items-center gap-2'>
                <p className='font-medium'>{app.name}</p>
                {app.website && (
                  <a
                    href={app.website}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-muted-foreground hover:text-foreground'
                  >
                    <IconExternalLink size={14} />
                  </a>
                )}
              </div>
              <p className='text-muted-foreground text-xs'>
                Authorized{' '}
                {app.createdAt
                  ? formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })
                  : 'recently'}
              </p>
            </div>
          </div>
          <Button
            variant='ghost'
            size='sm'
            className='text-destructive hover:text-destructive'
            onClick={() => revokeMutation.mutate({ applicationId: app.id })}
            disabled={revokeMutation.isPending}
          >
            <IconTrash size={14} />
            Revoke
          </Button>
        </div>
      ))}
    </div>
  )
}
