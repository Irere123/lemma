import { IconLoader2 } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
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
import { useTRPC } from '@/trpc/client'

export function AddSubscriberDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')

  const add = useMutation(
    trpc.newsletter.addSubscriber.mutationOptions({
      onSuccess: async () => {
        toast.success('Subscriber added')
        setEmail('')
        await queryClient.invalidateQueries({ queryKey: [['newsletter']] })
        onAdded()
        onOpenChange(false)
      },
      onError: (error) => {
        toast.error(error.message || 'Could not add subscriber')
      },
    })
  )

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = email.trim()
    if (!value) return
    add.mutate({ email: value })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label='Add subscriber'>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add subscriber</DialogTitle>
            <DialogDescription>
              Add a contact directly to your list. They'll be marked confirmed and won't receive a
              confirmation email — only add addresses you have permission to email.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className='space-y-2'>
              <Label htmlFor='add-subscriber-email'>Email</Label>
              <Input
                id='add-subscriber-email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='reader@example.com'
                // biome-ignore lint/a11y/noAutofocus: focusing the only field on open is expected
                autoFocus
                required
              />
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button type='submit' disabled={add.isPending}>
              {add.isPending && <IconLoader2 className='size-4 animate-spin' />}
              Add subscriber
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
