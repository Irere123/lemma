import { IconLoader2 } from '@tabler/icons-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useTRPC } from '@/trpc/client'

type Mode = 'now' | 'schedule'

export function NewNewsletterDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: documentsData, isLoading: docsLoading } = useQuery(
    trpc.documents.getUserDocuments.queryOptions({ status: 'PUBLISHED', limit: 100 })
  )
  const publishedDocs = useMemo(() => documentsData?.documents ?? [], [documentsData])

  const [documentId, setDocumentId] = useState('')
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<Mode>('now')
  const [scheduledAt, setScheduledAt] = useState('')

  // Default the subject to the chosen post's title until the writer edits it.
  useEffect(() => {
    const doc = publishedDocs.find((d) => d.id === documentId)
    if (doc?.title) setTitle(doc.title)
  }, [documentId, publishedDocs])

  const create = useMutation(trpc.campaigns.create.mutationOptions())
  const send = useMutation(trpc.campaigns.send.mutationOptions())
  const schedule = useMutation(trpc.campaigns.schedule.mutationOptions())

  const isPending = create.isPending || send.isPending || schedule.isPending

  const reset = () => {
    setDocumentId('')
    setTitle('')
    setMode('now')
    setScheduledAt('')
  }

  const onSubmit = async () => {
    if (!documentId) {
      toast.error('Pick a post to send')
      return
    }
    if (mode === 'schedule') {
      if (!scheduledAt) {
        toast.error('Pick a date and time')
        return
      }
      if (new Date(scheduledAt).getTime() <= Date.now()) {
        toast.error('Scheduled time must be in the future')
        return
      }
    }

    try {
      const campaign = await create.mutateAsync({
        title: title.trim() || 'Untitled newsletter',
        documentId,
      })

      if (mode === 'now') {
        await send.mutateAsync({ campaignId: campaign.id, documentId })
        toast.success('Newsletter queued for sending')
      } else {
        await schedule.mutateAsync({
          campaignId: campaign.id,
          documentId,
          scheduledAt: new Date(scheduledAt).toISOString(),
        })
        toast.success('Newsletter scheduled')
      }

      await queryClient.invalidateQueries({ queryKey: [['campaigns']] })
      reset()
      onOpenChange(false)
      onCreated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create newsletter')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label='New newsletter'>
        <DialogHeader>
          <DialogTitle>Send a newsletter</DialogTitle>
          <DialogDescription>
            Email one of your published posts to your confirmed subscribers.
          </DialogDescription>
        </DialogHeader>

        <DialogPanel className='space-y-5'>
          <div className='space-y-2'>
            <Label htmlFor='newsletter-post'>Post</Label>
            {docsLoading ? (
              <p className='text-muted-foreground text-sm'>Loading your posts…</p>
            ) : publishedDocs.length === 0 ? (
              <p className='text-muted-foreground text-sm'>
                You have no published posts yet. Publish a post first, then send it.
              </p>
            ) : (
              <select
                id='newsletter-post'
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                className='w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs/5 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24'
              >
                <option value=''>Select a post…</option>
                {publishedDocs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title || 'Untitled'}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='newsletter-subject'>Subject</Label>
            <Input
              id='newsletter-subject'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='Email subject line'
            />
          </div>

          <div className='space-y-2'>
            <Label>When</Label>
            <div className='flex gap-1 rounded-lg border border-border/80 bg-muted/30 p-1'>
              {(['now', 'schedule'] as const).map((value) => (
                <button
                  key={value}
                  type='button'
                  onClick={() => setMode(value)}
                  className={cn(
                    'flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors',
                    mode === value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {value === 'now' ? 'Send now' : 'Schedule'}
                </button>
              ))}
            </div>
            {mode === 'schedule' && (
              <Input
                type='datetime-local'
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className='mt-2'
              />
            )}
          </div>
        </DialogPanel>

        <DialogFooter>
          <Button type='button' disabled={isPending || !documentId} onClick={onSubmit}>
            {isPending && <IconLoader2 className='size-4 animate-spin' />}
            {mode === 'now' ? 'Send newsletter' : 'Schedule newsletter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
