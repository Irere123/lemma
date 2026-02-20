import { ApiKeyForm } from '@/components/forms/api-key-form'
import { useApiKeysModalStore } from '@/stores/api-keys-modal'
import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '../ui/dialog'

export function EditApiKeyModal() {
  const { setData, type } = useApiKeysModalStore()

  return (
    <Dialog open={type === 'edit'} onOpenChange={() => setData(undefined)}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Edit API Key</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <ApiKeyForm onSuccess={() => setData(undefined)} />
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  )
}
