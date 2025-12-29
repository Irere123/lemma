import { IconLoader2 } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useOAuthAppsModalStore } from '@/stores/oauth-apps-modal'
import { useTRPC } from '@/trpc/client'

export function DeleteOAuthAppModal() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { isOpen, modalType, selectedApp, close } = useOAuthAppsModalStore()

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
    if (selectedApp) {
      deleteMutation.mutate({ id: selectedApp.id })
    }
  }

  return (
    <Dialog open={isOpen && modalType === 'delete'} onOpenChange={(open) => !open && close()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Delete OAuth Application</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{' '}
            <span className='font-semibold'>{selectedApp?.name}</span>? This action cannot be
            undone. All tokens associated with this application will be revoked.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className='gap-2'>
          <Button variant='outline' onClick={close}>
            Cancel
          </Button>
          <Button variant='destructive' onClick={handleDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending && <IconLoader2 className='animate-spin' size={16} />}
            Delete Application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
