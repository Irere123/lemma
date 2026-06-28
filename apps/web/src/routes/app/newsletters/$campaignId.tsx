import { IconArrowLeft, IconLoader2, IconSend } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { CampaignStatusBadge } from '@/components/newsletter/campaign-status-badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCampaignRealtime } from '@/hooks/use-campaign-realtime'
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

  // Live send progress + engagement, streamed from the campaign's Durable Object.
  const { snapshot, connected } = useCampaignRealtime(campaignId)

  // When realtime reports the send finished or new engagement, pull the
  // authoritative status/stats from the server so badges and counts settle.
  const lastSyncRef = useRef<string>('')
  useEffect(() => {
    if (!snapshot) return
    const signature = `${snapshot.status}:${snapshot.clicks}:${snapshot.unsubscribes}`
    if (signature === lastSyncRef.current) return
    lastSyncRef.current = signature
    queryClient.invalidateQueries({ queryKey: [['campaigns']] })
  }, [snapshot, queryClient])

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

  const isSending = snapshot?.status === 'sending'
  const progressPct =
    snapshot && snapshot.totalRecipients > 0
      ? Math.min(100, Math.round((snapshot.sentCount / snapshot.totalRecipients) * 100))
      : 0

  const statCards = [
    { label: 'Delivered', value: snapshot?.sentCount ?? stats?.totalSent },
    { label: 'Opens', value: snapshot?.opens },
    { label: 'Clicks', value: stats?.totalClicks ?? snapshot?.clicks },
    { label: 'Unsubscribes', value: stats?.totalUnsubscribes ?? snapshot?.unsubscribes },
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

      {isSending && snapshot && (
        <div className='mt-6 rounded-xl border bg-card p-4'>
          <div className='flex items-center justify-between gap-3'>
            <div className='flex items-center gap-2'>
              <span className='relative flex size-2'>
                {connected && (
                  <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75' />
                )}
                <span
                  className={`relative inline-flex size-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-muted-foreground'}`}
                />
              </span>
              <p className='font-medium text-sm'>
                {connected ? 'Sending…' : 'Sending… (reconnecting)'}
              </p>
            </div>
            <p className='text-muted-foreground text-sm tabular-nums'>
              {snapshot.sentCount.toLocaleString()} / {snapshot.totalRecipients.toLocaleString()}{' '}
              recipients
            </p>
          </div>
          <Progress className='mt-3' value={progressPct} />
          <p className='mt-2 text-muted-foreground text-xs tabular-nums'>
            Batch {snapshot.batchesDone} of {snapshot.totalBatches}
          </p>
        </div>
      )}

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
