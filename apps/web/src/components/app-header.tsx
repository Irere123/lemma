import { IconEdit, IconLogout, IconSettings, IconUser } from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { signOut, useSession } from '@/lib/auth-client'
import { documentStore } from '@/stores/document-store'
import { useTRPC } from '@/trpc/client'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { SidebarTrigger, useSidebar } from './ui/sidebar'

export function AppHeader() {
  const { open } = useSidebar()
  const trpc = useTRPC()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const { isPending: upsertLoading, mutateAsync: upsertDocument } = useMutation(
    trpc.documents.upsertDocument.mutationOptions()
  )

  const handleLogout = async () => {
    await signOut()
    navigate({ to: '/login' })
  }

  return (
    <div className='flex items-center gap-3 px-1 py-2'>
      <SidebarTrigger />
      {!open && (
        <div className='flex gap-2'>
          <Button variant='ghost' size='icon' className='size-7'>
            <IconSettings className='size-5' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='size-7'
            disabled={upsertLoading}
            onClick={async () => {
              const resp = await upsertDocument({
                content: {},
              })

              if (resp) {
                documentStore.getState().upsertDocument(resp as any)
                navigate({ to: '/write/$docId', params: { docId: resp.id } })
              }
            }}
          >
            <IconEdit className='size-5' />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='size-7'>
                <IconUser className='size-5' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-56'>
              {session?.user && (
                <div className='mb-1 px-2 py-1.5'>
                  <p className='font-medium text-sm'>{session.user.name}</p>
                  <p className='truncate text-muted-foreground text-xs'>{session.user.email}</p>
                </div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className='cursor-pointer text-destructive focus:text-destructive'
              >
                <IconLogout className='mr-2 h-4 w-4' />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}
