import { IconAlertTriangle, IconKey } from '@tabler/icons-react'

import { CopyInput } from '@/components/copy-input'
import { OAuthAppForm } from '@/components/forms/oauth-app-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
import { useOAuthAppsModalStore } from '@/stores/oauth-apps-modal'

export function OAuthAppModal() {
  const { isOpen, modalType, selectedApp, clientSecret, close } = useOAuthAppsModalStore()

  if (modalType === 'view-credentials' && selectedApp) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <IconKey size={20} />
              Application Credentials
            </DialogTitle>
            <DialogDescription>
              Save these credentials securely. The client secret will only be shown once.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className='rounded-lg border border-yellow-200 bg-yellow-50 p-3'>
              <div className='flex items-start gap-2'>
                <IconAlertTriangle className='mt-0.5 text-yellow-600' size={16} />
                <p className='text-sm text-yellow-800'>
                  Make sure to copy your client secret now. You won&apos;t be able to see it again.
                </p>
              </div>
            </div>

            <div className='space-y-3'>
              <div className='space-y-2'>
                <span className='font-medium text-muted-foreground text-sm'>Client ID</span>
                <CopyInput value={selectedApp.clientId} />
              </div>

              <div className='space-y-2'>
                <span className='font-medium text-muted-foreground text-sm'>Client Secret</span>
                {clientSecret ? (
                  <CopyInput value={clientSecret} />
                ) : (
                  <p className='text-muted-foreground text-sm'>
                    Client secret is hidden. Regenerate it to view a new value.
                  </p>
                )}
              </div>
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button onClick={close}>Done</Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    )
  }

  return (
    <Dialog
      open={isOpen && (modalType === 'create' || modalType === 'edit')}
      onOpenChange={(open) => !open && close()}
    >
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>
            {modalType === 'edit' ? 'Edit OAuth Application' : 'Create OAuth Application'}
          </DialogTitle>
          <DialogDescription>
            {modalType === 'edit'
              ? 'Update your OAuth application settings.'
              : 'Register a new OAuth application to integrate with Lemma.'}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <OAuthAppForm app={selectedApp} />
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  )
}
