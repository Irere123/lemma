import { ApiKeyForm } from '@/components/forms/api-key-form'
import { useApiKeysModalStore } from '@/stores/api-keys-modal'
import { CopyInput } from '../copy-input'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '../ui/dialog'

export function CreateApiKeyModal() {
  const { setData, createdKey, type, setCreatedKey } = useApiKeysModalStore()

  let content = null

  if (createdKey) {
    content = (
      <>
        <DialogHeader>
          <DialogTitle>API Key Created</DialogTitle>
          <DialogDescription>
            For security reasons, the key will only be shown once. Please copy and store it in a
            secure location.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <CopyInput value={createdKey} />
        </DialogPanel>
        <DialogFooter>
          <Button onClick={() => setData(undefined)}>Done</Button>
        </DialogFooter>
      </>
    )
  } else {
    content = (
      <>
        <DialogHeader>
          <DialogTitle>Create New API Key</DialogTitle>
          <DialogDescription>Create a new API key for your team.</DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <ApiKeyForm
            onSuccess={(key) => {
              if (key) {
                setCreatedKey(key)
              }
            }}
          />
        </DialogPanel>
      </>
    )
  }

  return (
    <Dialog
      open={type === 'create'}
      onOpenChange={() => {
        setData(undefined)
        setTimeout(() => {
          setCreatedKey(undefined)
        }, 500)
      }}
    >
      <DialogPopup>{content}</DialogPopup>
    </Dialog>
  )
}
