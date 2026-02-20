import { IconLoader2 } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
import { useOAuthAppsModalStore } from '@/stores/oauth-apps-modal'
import { useTRPC } from '@/trpc/client'

export function DeleteOAuthAppModal() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { isOpen, modalType, selectedApp, close } = useOAuthAppsModalStore()
  const hasSelection = typeof selectedApp?.id === 'string'

  const deleteMutation = useMutation(
    trpc.oauthApplications.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [['oauthApplications', 'list']] })
        toast.success('OAuth application deleted successfully')
        close()
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to delete OAuth application')
      },
    })
  )

  const handleDelete = () => {
    if (hasSelection && selectedApp?.id) {
      deleteMutation.mutate({ id: selectedApp.id })
    }
  }

  return (
    <Dialog open={isOpen && modalType === 'delete'} onOpenChange={(open) => !open && close()}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Delete OAuth Application</DialogTitle>
          <DialogDescription>
            This will permanently delete <span className='text-primary'>{selectedApp?.name}</span>{' '}
            and revoke all tokens associated with this application. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            className='w-full mt-4'
            variant='destructive'
            onClick={handleDelete}
            disabled={!hasSelection || deleteMutation.isPending}
          >
            {deleteMutation.isPending && <IconLoader2 className='animate-spin' size={16} />}
            Delete Application
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
