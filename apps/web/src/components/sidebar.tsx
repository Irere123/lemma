import {
  IconAlignJustified,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUserCircle,
} from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import { cn } from '@/lib/utils'
import { AccountDropdown } from './dropdowns/account'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'

export function Sidebar() {
  return (
    <div className='flex flex-col gap-4 h-screen sticky border-r border-neutral-200 sm:w-72 w-16 top-0 z-50'>
      <div className='flex items-center justify-between p-4 border-b border-neutral-200'>
        <h2 className='text-xl font-bold'>Lemma</h2>
        <AccountDropdown />
      </div>
      <div className='flex gap-2 px-2'>
        <SidebarLink href='/app' icon={<IconAlignJustified size={20} />} />
        <SidebarLink href='/app/search' icon={<IconSearch size={20} />} />
        <SidebarLink href='/app/new' icon={<IconPlus size={20} />} />
        <SidebarLink href='/u/profile' icon={<IconUserCircle size={20} />} />
        <SidebarLink href='/app/settings' icon={<IconSettings size={20} />} />
      </div>
      <div className='flex flex-1 px-2.5 flex-col gap-2'>
        <h2 className='text-md font-semibold'>Archive</h2>
        {/* <DocumentsHistoryList /> */}
      </div>
      <div className='flex items-center gap-2 p-2'>
        <Avatar className='rounded-full size-9'>
          <AvatarImage
            alt='User'
            src='https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=128&h=128&dpr=2&q=80'
          />
          <AvatarFallback>AV</AvatarFallback>
        </Avatar>
        <div className='flex flex-col text-sm'>
          <p className='font-semibold'>Irere Emmanuel</p>
          <p className='text-muted-foreground'>irere@lemma.ai</p>
        </div>
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
      className={cn('p-2 rounded-md', className)}
      activeProps={{ className: 'bg-muted' }}
    >
      {icon}
    </Link>
  )
}
