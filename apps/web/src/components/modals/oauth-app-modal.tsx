import { IconAlertTriangle, IconCheck, IconCopy, IconKey } from '@tabler/icons-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { OAuthAppForm } from '@/components/forms/oauth-app-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useOAuthAppsModalStore } from '@/stores/oauth-apps-modal'

export function OAuthAppModal() {
  const { isOpen, modalType, selectedApp, clientSecret, close } = useOAuthAppsModalStore()
  const [copied, setCopied] = useState<'clientId' | 'clientSecret' | null>(null)

  const copyToClipboard = (text: string, type: 'clientId' | 'clientSecret') => {
    navigator.clipboard.writeText(text)
    setCopied(type)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(null), 2000)
  }

  if (modalType === 'view-credentials' && selectedApp) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <IconKey size={20} />
              Application Credentials
            </DialogTitle>
            <DialogDescription>
              Save these credentials securely. The client secret will not be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-900/20'>
              <div className='flex items-start gap-2'>
                <IconAlertTriangle className='mt-0.5 text-yellow-600' size={16} />
                <p className='text-sm text-yellow-800 dark:text-yellow-200'>
                  Make sure to copy your client secret now. You won&apos;t be able to see it again!
                </p>
              </div>
            </div>

            <div className='space-y-3'>
              <div className='space-y-1'>
                <span className='font-medium text-muted-foreground text-sm'>Client ID</span>
                <div className='flex items-center gap-2'>
                  <code className='flex-1 break-all rounded bg-muted px-3 py-2 font-mono text-sm'>
                    {selectedApp.clientId}
                  </code>
                  <Button
                    variant='outline'
                    size='icon'
                    onClick={() => copyToClipboard(selectedApp.clientId, 'clientId')}
                  >
                    {copied === 'clientId' ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </Button>
                </div>
              </div>

              {clientSecret && (
                <div className='space-y-1'>
                  <span className='font-medium text-muted-foreground text-sm'>Client Secret</span>
                  <div className='flex items-center gap-2'>
                    <code className='flex-1 break-all rounded bg-muted px-3 py-2 font-mono text-sm'>
                      {clientSecret}
                    </code>
                    <Button
                      variant='outline'
                      size='icon'
                      onClick={() => copyToClipboard(clientSecret, 'clientSecret')}
                    >
                      {copied === 'clientSecret' ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className='flex justify-end pt-2'>
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog
      open={isOpen && (modalType === 'create' || modalType === 'edit')}
      onOpenChange={(open) => !open && close()}
    >
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            {modalType === 'edit' ? 'Edit OAuth Application' : 'Create OAuth Application'}
          </DialogTitle>
          <DialogDescription>
            {modalType === 'edit'
              ? 'Update your OAuth application settings'
              : 'Register a new OAuth application to integrate with Lemma'}
          </DialogDescription>
        </DialogHeader>

        <OAuthAppForm app={selectedApp} />
      </DialogContent>
    </Dialog>
  )
}
