import {
  IconAlignJustified,
  IconLoader2,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUserCircle,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { useSession } from '@/lib/auth-client'
import { cn, getUntitledTitle } from '@/lib/utils'
import { useDocumentStore } from '@/stores/document-store'
import { useTRPC } from '@/trpc/client'
import { AccountDropdown } from './dropdowns/account'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Skeleton } from './ui/skeleton'

export function Sidebar() {
  const { data: session, isPending } = useSession()

  return (
    <div className='flex flex-col gap-4 h-screen sticky border-r px-2 border-neutral-200 top-0 z-50'>
      <div className='flex items-center justify-between p-4 border-b border-neutral-200'>
        <AccountDropdown />
      </div>
      <div className='flex flex-col gap-2 flex-1 items-center'>
        <SidebarLink href='/app' icon={<IconAlignJustified size={20} />} />
        <SidebarLink href='/app/search' icon={<IconSearch size={20} />} />
        <SidebarCreateDocumentButton />
        <SidebarLink href='/u/profile' icon={<IconUserCircle size={20} />} />
        <SidebarLink href='/app/settings' icon={<IconSettings size={20} />} />
      </div>
      <div className='flex items-center justify-center gap-2 p-2'>
        {isPending ? (
          <Skeleton className='rounded-full size-9' />
        ) : (
          <Avatar className='rounded-full size-9'>
            <AvatarImage alt='User' src={session?.user?.image ?? undefined} />
            <AvatarFallback>{session?.user?.name?.charAt(0)}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  )
}

function SidebarCreateDocumentButton() {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const upsertDocumentInStore = useDocumentStore((state) => state.upsertDocument)

  const createDocumentMutation = useMutation(
    trpc.documents.upsertDocument.mutationOptions({
      onSuccess: async (document) => {
        if (!document?.id) {
          toast.error('Failed to create document')
          return
        }

        upsertDocumentInStore(document as any)

        await navigate({
          to: '/write/$docId',
          params: {
            docId: document.id,
          },
        })
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to create document')
      },
    })
  )

  const handleCreateDocument = () => {
    if (createDocumentMutation.isPending) {
      return
    }

    createDocumentMutation.mutate({
      title: getUntitledTitle(''),
      markdown: '',
    })
  }

  return (
    <button
      type='button'
      className={cn('rounded-full p-2 transition-colors hover:bg-muted')}
      onClick={handleCreateDocument}
      disabled={createDocumentMutation.isPending}
      aria-label='Create new document'
      title='Create new document'
    >
      {createDocumentMutation.isPending ? (
        <IconLoader2 size={20} className='animate-spin' />
      ) : (
        <IconPlus size={20} />
      )}
    </button>
  )
}

const SidebarLink = ({
  icon,
  href,
  className,
}: {
  icon: React.ReactNode
  href: string
  className?: string
}) => {
  return (
    <Link
      to={href}
      className={cn('p-2 rounded-full ', className)}
      activeProps={{ className: 'bg-muted' }}
    >
      {icon}
    </Link>
  )
}
