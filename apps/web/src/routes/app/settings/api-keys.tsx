import { IconPlus } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'

import { CreateApiKeyModal } from '@/components/modals/create-api-key-modal'
import { DeleteApiKeyModal } from '@/components/modals/delete-api-key-modal'
import { EditApiKeyModal } from '@/components/modals/edit-api-key-modal'
import { DataTable as ApiKeysTable } from '@/components/tables/api-keys'
import { Button } from '@/components/ui/button'
import { useApiKeysModalStore } from '@/stores/api-keys-modal'

export const Route = createFileRoute('/app/settings/api-keys')({
  component: RouteComponent,
})

function RouteComponent() {
  const { setData } = useApiKeysModalStore()

  return (
    <section className='space-y-6'>
      <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
        <div className='space-y-2'>
          <h3 className='font-semibold text-xl tracking-tight'>API Keys</h3>
          <p className='max-w-2xl text-muted-foreground text-sm'>
            These API keys allow external apps to access your data. Keep them private and never
            expose them in browser code.
          </p>
        </div>
        <Button onClick={() => setData(undefined, 'create')}>
          <IconPlus size={16} />
          Create API Key
        </Button>
      </div>

      <ApiKeysTable />

      <EditApiKeyModal />
      <DeleteApiKeyModal />
      <CreateApiKeyModal />
    </section>
  )
}
