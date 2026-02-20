import { IconLoader } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useApiKeysModalStore } from '@/stores/api-keys-modal'
import { useTRPC } from '@/trpc/client'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from '../ui/dialog'

export function DeleteApiKeyModal() {
  const { setData, type, data } = useApiKeysModalStore()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const hasSelection = typeof data?.id === 'string'

  const deleteApiKeyMutation = useMutation(
    trpc.apiKeys.delete.mutationOptions({
      onSuccess: () => {
        setData(undefined)
        queryClient.invalidateQueries(trpc.apiKeys.get.queryOptions())
      },
    })
  )

  return (
    <Dialog open={type === 'delete'} onOpenChange={() => setData(undefined)}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Delete API Key</DialogTitle>
          <DialogDescription>
            This will permanently delete the API key{' '}
            <span className='text-primary'>{data?.name}</span> for and revoke all access to your
            account. Are you sure you want to continue?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            className='w-full mt-4'
            onClick={() => {
              if (!hasSelection || !data?.id) {
                return
              }
              deleteApiKeyMutation.mutate({ id: data.id })
            }}
            disabled={!hasSelection || deleteApiKeyMutation.isPending}
          >
            {deleteApiKeyMutation.isPending ? <IconLoader className='animate-spin' /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
