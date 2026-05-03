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
import type { ReactElement, ReactNode } from 'react'
import { toast } from 'sonner'

import { useSession } from '@/lib/auth-client'
import { cn, getUntitledTitle } from '@/lib/utils'
import { useDocumentStore } from '@/stores/document-store'
import { useTRPC } from '@/trpc/client'
import { AccountDropdown } from './dropdowns/account'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Skeleton } from './ui/skeleton'
import { Tooltip, TooltipPopup, TooltipTrigger } from './ui/tooltip'

export function Sidebar() {
  const { data: session, isPending } = useSession()

  return (
    <nav
      aria-label='Primary'
      className='sticky top-0 z-50 hidden h-screen w-16 shrink-0 flex-col gap-3 border-neutral-200 border-r bg-background px-2 md:flex'
    >
      <div className='flex items-center justify-center border-neutral-200 border-b py-3'>
        <AccountDropdown />
      </div>
      <div className='flex flex-1 flex-col items-center gap-2'>
        <SidebarLink href='/app' icon={<IconAlignJustified size={20} />} label='Library' />
        <SidebarLink href='/app/search' icon={<IconSearch size={20} />} label='Search' />
        <SidebarCreateDocumentButton />
        <SidebarLink href='/u/profile' icon={<IconUserCircle size={20} />} label='Profile' />
        <SidebarLink href='/app/settings' icon={<IconSettings size={20} />} label='Settings' />
      </div>
      <div className='flex items-center justify-center gap-2 py-3'>
        {isPending ? (
          <Skeleton className='rounded-full size-9' />
        ) : (
          <Avatar className='rounded-full size-9'>
            <AvatarImage alt='User' src={session?.user?.image ?? undefined} />
            <AvatarFallback>{session?.user?.name?.charAt(0)}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </nav>
  )
}

export function SidebarCreateDocumentButton({ className }: { className?: string }) {
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

  const button = (
    <button
      type='button'
      className={cn(
        'flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      onClick={handleCreateDocument}
      disabled={createDocumentMutation.isPending}
      aria-label='Create new document'
    >
      {createDocumentMutation.isPending ? (
        <IconLoader2 size={20} className='animate-spin' />
      ) : (
        <IconPlus size={20} />
      )}
    </button>
  )

  return (
    <Tooltip>
      <TooltipTrigger render={button as ReactElement<Record<string, unknown>>} />
      <TooltipPopup side='right'>Create document</TooltipPopup>
    </Tooltip>
  )
}

const SidebarLink = ({
  icon,
  href,
  label,
  className,
}: {
  icon: ReactNode
  href: string
  label: string
  className?: string
}) => {
  const link = (
    <Link
      to={href}
      aria-label={label}
      className={cn(
        'flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      activeProps={{ className: 'bg-muted text-foreground' }}
    >
      {icon}
    </Link>
  )

  return (
    <Tooltip>
      <TooltipTrigger render={link as ReactElement<Record<string, unknown>>} />
      <TooltipPopup side='right'>{label}</TooltipPopup>
    </Tooltip>
  )
}
