import {
  IconAlignJustified,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUserCircle,
} from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
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
        <SidebarLink href='/app/new' icon={<IconPlus size={20} />} />
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
