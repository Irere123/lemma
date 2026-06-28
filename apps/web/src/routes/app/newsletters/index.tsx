import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { CampaignStatusBadge } from '@/components/newsletter/campaign-status-badge'
import { NewNewsletterDialog } from '@/components/newsletter/new-newsletter-dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/app/newsletters/')({
  component: RouteComponent,
})

function whenLabel(campaign: {
  status: string | null
  sentAt: Date | null
  scheduledAt: Date | null
  createdAt: Date | null | undefined
}): string {
  const fmt = (value: Date | string | null | undefined) => {
    if (!value) return ''
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  if (campaign.sentAt) return `Sent ${fmt(campaign.sentAt)}`
  if (campaign.scheduledAt) return `Scheduled for ${fmt(campaign.scheduledAt)}`
  return `Created ${fmt(campaign.createdAt)}`
}

function RouteComponent() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [newOpen, setNewOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  const campaignsQuery = trpc.campaigns.list.queryOptions({})
  const { data: campaigns, isLoading } = useQuery(campaignsQuery)

  const remove = useMutation(
    trpc.campaigns.delete.mutationOptions({
      onSuccess: async () => {
        toast.success('Newsletter deleted')
        setDeleteTarget(null)
        await queryClient.invalidateQueries({ queryKey: [['campaigns']] })
      },
      onError: (error) => toast.error(error.message || 'Could not delete newsletter'),
    })
  )

  return (
    <main className='mx-auto w-full max-w-5xl px-5 py-8 md:px-10'>
      <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
        <div className='space-y-2'>
          <h2 className='font-semibold text-2xl tracking-tight'>Newsletters</h2>
          <p className='max-w-2xl text-muted-foreground text-sm'>
            Send your published posts to subscribers and track how each one performs.
          </p>
        </div>
        <Button className='shrink-0' onClick={() => setNewOpen(true)}>
          <IconPlus size={16} />
          New newsletter
        </Button>
      </div>

      <div className='mt-6'>
        {isLoading ? (
          <div className='space-y-3'>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className='h-16 w-full rounded-xl' />
            ))}
          </div>
        ) : !campaigns || campaigns.length === 0 ? (
          <div className='rounded-xl border bg-card px-6 py-16 text-center'>
            <p className='font-medium text-sm'>No newsletters yet</p>
            <p className='mt-1 text-muted-foreground text-sm'>
              Send your first published post to your subscribers.
            </p>
            <Button className='mt-4' onClick={() => setNewOpen(true)}>
              <IconPlus size={16} />
              New newsletter
            </Button>
          </div>
        ) : (
          <ul className='space-y-2'>
            {campaigns.map((campaign) => (
              <li
                key={campaign.id}
                className='flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40'
              >
                <Link
                  to='/app/newsletters/$campaignId'
                  params={{ campaignId: campaign.id }}
                  className='min-w-0 flex-1'
                >
                  <p className='truncate font-medium'>{campaign.title}</p>
                  <p className='mt-0.5 text-muted-foreground text-xs'>{whenLabel(campaign)}</p>
                </Link>
                <CampaignStatusBadge status={campaign.status} />
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label={`Delete ${campaign.title}`}
                  onClick={() => setDeleteTarget({ id: campaign.id, title: campaign.title })}
                >
                  <IconTrash size={15} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <NewNewsletterDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: [['campaigns']] })}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title='Delete newsletter?'
        description={
          deleteTarget ? `"${deleteTarget.title}" will be permanently deleted.` : undefined
        }
        confirmText='Delete'
        isConfirmLoading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate({ id: deleteTarget.id })}
      />
    </main>
  )
}
