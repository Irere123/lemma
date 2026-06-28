import { IconArrowLeft, IconLoader2, IconSend } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { toast } from 'sonner'

import { CampaignStatusBadge } from '@/components/newsletter/campaign-status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/app/newsletters/$campaignId')({
  component: RouteComponent,
})

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function RouteComponent() {
  const { campaignId } = Route.useParams()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const campaignQuery = trpc.campaigns.get.queryOptions({ id: campaignId })
  const { data: campaign, isLoading } = useQuery(campaignQuery)

  const { data: stats } = useQuery(trpc.campaigns.stats.queryOptions({ campaignId }))

  const send = useMutation(
    trpc.campaigns.send.mutationOptions({
      onSuccess: async (res) => {
        toast.success(res.message || 'Newsletter queued')
        await queryClient.invalidateQueries({ queryKey: [['campaigns']] })
      },
      onError: (error) => toast.error(error.message || 'Could not send newsletter'),
    })
  )

  if (isLoading) {
    return (
      <main className='mx-auto w-full max-w-4xl px-5 py-8 md:px-10'>
        <Skeleton className='h-6 w-40' />
        <Skeleton className='mt-4 h-10 w-2/3' />
        <div className='mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4'>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className='h-20 w-full rounded-xl' />
          ))}
        </div>
      </main>
    )
  }

  if (!campaign) {
    return (
      <main className='mx-auto w-full max-w-4xl px-5 py-16 text-center md:px-10'>
        <p className='font-medium'>Newsletter not found</p>
        <Link
          to='/app/newsletters'
          className='mt-3 inline-block text-muted-foreground text-sm underline'
        >
          Back to newsletters
        </Link>
      </main>
    )
  }

  const canSend = campaign.status === 'DRAFT' && !!campaign.documentId

  const statCards = [
    { label: 'Total clicks', value: stats?.totalClicks },
    { label: 'Unique clicks', value: stats?.uniqueClicks },
    { label: 'Unsubscribes', value: stats?.totalUnsubscribes },
    {
      label: 'Click rate',
      value: stats ? `${Math.round((stats.clickRate ?? 0) * 10) / 10}%` : undefined,
    },
  ]

  return (
    <main className='mx-auto w-full max-w-4xl px-5 py-8 md:px-10'>
      <Link
        to='/app/newsletters'
        className='inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground'
      >
        <IconArrowLeft size={15} />
        Newsletters
      </Link>

      <div className='mt-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
        <div className='min-w-0 space-y-2'>
          <div className='flex items-center gap-3'>
            <h2 className='font-semibold text-2xl tracking-tight'>{campaign.title}</h2>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          <p className='text-muted-foreground text-sm'>
            {campaign.sentAt
              ? `Sent ${formatDateTime(campaign.sentAt)}`
              : campaign.scheduledAt
                ? `Scheduled for ${formatDateTime(campaign.scheduledAt)}`
                : `Created ${formatDateTime(campaign.createdAt)}`}
          </p>
        </div>
        {canSend && (
          <Button
            className='shrink-0'
            disabled={send.isPending}
            onClick={() =>
              campaign.documentId &&
              send.mutate({ campaignId: campaign.id, documentId: campaign.documentId })
            }
          >
            {send.isPending ? (
              <IconLoader2 className='size-4 animate-spin' />
            ) : (
              <IconSend size={16} />
            )}
            Send now
          </Button>
        )}
      </div>

      <div className='mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4'>
        {statCards.map((card) => (
          <div key={card.label} className='rounded-xl border bg-card p-4'>
            <p className='text-muted-foreground text-xs'>{card.label}</p>
            <p className='mt-1 font-semibold text-2xl tabular-nums'>{card.value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className='mt-8 space-y-3'>
        <h3 className='font-semibold text-sm'>Link clicks</h3>
        {!stats?.linkClicks || stats.linkClicks.length === 0 ? (
          <div className='rounded-xl border bg-card px-6 py-10 text-center text-muted-foreground text-sm'>
            No link clicks tracked yet.
          </div>
        ) : (
          <div className='overflow-hidden rounded-xl border bg-card'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Link</TableHead>
                  <TableHead className='text-right'>Clicks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.linkClicks.map((link) => (
                  <TableRow key={link.linkId}>
                    <TableCell className='max-w-md truncate'>{link.label || link.url}</TableCell>
                    <TableCell className='text-right tabular-nums'>{link.clicks}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </main>
  )
}
