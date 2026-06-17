import {
  IconCards,
  IconChevronDown,
  IconHelpCircle,
  IconLogout,
  IconMessageCircle,
  IconUserCircle,
} from '@tabler/icons-react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { useEffect } from 'react'

import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { signOut, useSession } from '@/lib/auth-client'
import { useTRPC } from '@/trpc/client'
import { Button } from '../ui/button'

export function AccountDropdown({
  children,
  triggerClassName,
  side = 'bottom',
  align = 'start',
}: {
  // Optional custom trigger content. When omitted, falls back to the default
  // chevron button so existing call sites keep working.
  children?: ReactNode
  triggerClassName?: string
  side?: ComponentProps<typeof MenuPopup>['side']
  align?: ComponentProps<typeof MenuPopup>['align']
}) {
  const { data: session, refetch } = useSession()
  const navigate = useNavigate()
  const trpc = useTRPC()
  const username = session?.user?.username ?? null

  const ensureUsername = useMutation(
    trpc.profile.ensureUsername.mutationOptions({
      onSuccess: () => refetch(),
    })
  )

  // Backfill a handle for accounts created before handles existed, so the
  // profile link works for everyone.
  useEffect(() => {
    if (session?.user && !session.user.username && !ensureUsername.isPending) {
      ensureUsername.mutate(undefined)
    }
  }, [session?.user, ensureUsername])

  const trigger = children ? (
    <button type='button' className={triggerClassName}>
      {children}
    </button>
  ) : (
    <Button variant='ghost' size='icon'>
      <IconChevronDown />
    </Button>
  )

  return (
    <Menu>
      <MenuTrigger render={trigger as ReactElement<Record<string, unknown>>} />
      <MenuPopup align={align} side={side} sideOffset={4} className='min-w-54!'>
        <MenuItem
          disabled={!username}
          render={
            <Link to='/u/$username' params={{ username: username ?? '' }}>
              <IconUserCircle />
              Profile
            </Link>
          }
        />
        <MenuItem>
          <IconCards /> Plans
        </MenuItem>
        <MenuSeparator />
        <MenuItem>
          <IconHelpCircle />
          Help
        </MenuItem>
        <MenuItem>
          <IconMessageCircle />
          Feedback
        </MenuItem>
        <MenuItem
          onClick={() => {
            void signOut().then(() => navigate({ to: '/login' }))
          }}
        >
          <IconLogout /> Logout
        </MenuItem>
      </MenuPopup>
    </Menu>
  )
}
