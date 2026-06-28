import { IconDownload, IconMailForward, IconPlus, IconTrash } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { AddSubscriberDialog } from '@/components/newsletter/add-subscriber-dialog'
import {
  type SubscriberStatus,
  SubscriberStatusBadge,
  subscriberStatus,
} from '@/components/newsletter/status-badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useTRPC } from '@/trpc/client'

export const Route = createFileRoute('/app/subscribers')({
  component: RouteComponent,
})

type Filter = 'all' | SubscriberStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
]

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function RouteComponent() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const [filter, setFilter] = useState<Filter>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{ id: string; email: string } | null>(null)

  const statsQuery = trpc.newsletter.subscriberStats.queryOptions()
  const { data: stats } = useQuery(statsQuery)

  const subscribersQuery = trpc.newsletter.subscribers.queryOptions({ status: filter, limit: 100 })
  const { data: subscribers, isLoading } = useQuery(subscribersQuery)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [['newsletter']] })

  const resend = useMutation(
    trpc.newsletter.resendConfirmation.mutationOptions({
      onSuccess: (res) => toast.success(res.message || 'Confirmation email sent'),
      onError: (error) => toast.error(error.message || 'Could not resend confirmation'),
    })
  )

  const remove = useMutation(
    trpc.newsletter.removeSubscriber.mutationOptions({
      onSuccess: async () => {
        toast.success('Subscriber removed')
        setRemoveTarget(null)
        await invalidate()
      },
      onError: (error) => toast.error(error.message || 'Could not remove subscriber'),
    })
  )

  const exportCsv = () => {
    if (!subscribers || subscribers.length === 0) {
      toast.error('Nothing to export')
      return
    }
    const header = ['email', 'status', 'subscribed_at', 'confirmed_at']
    const rows = subscribers.map((s) => [
      s.email,
      subscriberStatus(s),
      s.subscribedAt ? new Date(s.subscribedAt).toISOString() : '',
      s.confirmedAt ? new Date(s.confirmedAt).toISOString() : '',
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `subscribers-${filter}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const statCards = [
    { label: 'Total', value: stats?.total },
    { label: 'Confirmed', value: stats?.confirmed },
    { label: 'Pending', value: stats?.pending },
    { label: 'Unsubscribed', value: stats?.unsubscribed },
  ]

  return (
    <main className='mx-auto w-full max-w-5xl px-5 py-8 md:px-10'>
      <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
        <div className='space-y-2'>
          <h2 className='font-semibold text-2xl tracking-tight'>Subscribers</h2>
          <p className='max-w-2xl text-muted-foreground text-sm'>
            Everyone subscribed to your newsletter. Add contacts manually, resend confirmations, or
            export your list.
          </p>
        </div>
        <div className='flex shrink-0 gap-2'>
          <Button variant='outline' onClick={exportCsv}>
            <IconDownload size={16} />
            Export CSV
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <IconPlus size={16} />
            Add subscriber
          </Button>
        </div>
      </div>

      <div className='mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4'>
        {statCards.map((card) => (
          <div key={card.label} className='rounded-xl border bg-card p-4'>
            <p className='text-muted-foreground text-xs'>{card.label}</p>
            <p className='mt-1 font-semibold text-2xl tabular-nums'>{card.value ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className='mt-6 flex w-fit flex-wrap gap-1 rounded-xl border border-border/80 bg-muted/30 p-1'>
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type='button'
            onClick={() => setFilter(option.value)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 font-medium text-sm transition-colors',
              filter === option.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className='mt-4 overflow-hidden rounded-xl border bg-card'>
        {isLoading ? (
          <div className='space-y-3 p-4'>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className='h-10 w-full' />
            ))}
          </div>
        ) : !subscribers || subscribers.length === 0 ? (
          <div className='px-6 py-16 text-center'>
            <p className='font-medium text-sm'>No subscribers here yet</p>
            <p className='mt-1 text-muted-foreground text-sm'>
              {filter === 'all'
                ? 'Share your profile or add contacts to start building your list.'
                : `No ${filter} subscribers.`}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Subscribed</TableHead>
                <TableHead>Confirmed</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((sub) => {
                const status = subscriberStatus(sub)
                return (
                  <TableRow key={sub.id}>
                    <TableCell className='font-medium'>{sub.email}</TableCell>
                    <TableCell>
                      <SubscriberStatusBadge status={status} />
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {formatDate(sub.subscribedAt)}
                    </TableCell>
                    <TableCell className='text-muted-foreground'>
                      {formatDate(sub.confirmedAt)}
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center justify-end gap-1'>
                        {status === 'pending' && (
                          <Button
                            variant='ghost'
                            size='sm'
                            disabled={resend.isPending}
                            onClick={() => resend.mutate({ email: sub.email })}
                          >
                            <IconMailForward size={15} />
                            Resend
                          </Button>
                        )}
                        <Button
                          variant='ghost'
                          size='icon'
                          aria-label={`Remove ${sub.email}`}
                          onClick={() => setRemoveTarget({ id: sub.id, email: sub.email })}
                        >
                          <IconTrash size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <AddSubscriberDialog open={addOpen} onOpenChange={setAddOpen} onAdded={invalidate} />

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title='Remove subscriber?'
        description={
          removeTarget
            ? `${removeTarget.email} will be permanently removed from your list.`
            : undefined
        }
        confirmText='Remove'
        isConfirmLoading={remove.isPending}
        onConfirm={() => removeTarget && remove.mutate({ id: removeTarget.id })}
      />
    </main>
  )
}
