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
import { Monitor, Moon, Sun } from 'lucide-react'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { useEffect } from 'react'

import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from '@/components/ui/menu'
import { signOut, useSession } from '@/lib/auth-client'
import { clearLocalDocuments } from '@/lib/collab/local-store'
import { type ThemePreference, useTheme } from '@/lib/theme'
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
  const theme = useTheme()
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
        <MenuSub>
          <MenuSubTrigger>
            {theme.resolved === 'dark' ? <Moon /> : <Sun />}
            Theme
          </MenuSubTrigger>
          <MenuSubPopup className='min-w-40'>
            <MenuRadioGroup
              value={theme.preference}
              onValueChange={(value) => theme.setTheme(value as ThemePreference)}
            >
              <MenuRadioItem value='light'>
                <Sun /> Light
              </MenuRadioItem>
              <MenuRadioItem value='dark'>
                <Moon /> Dark
              </MenuRadioItem>
              <MenuRadioItem value='system'>
                <Monitor /> System
              </MenuRadioItem>
            </MenuRadioGroup>
          </MenuSubPopup>
        </MenuSub>
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
            // Documents are cached on the device for offline use; don't leave them behind.
            void signOut()
              .then(() => clearLocalDocuments())
              .then(() => navigate({ to: '/login' }))
          }}
        >
          <IconLogout /> Logout
        </MenuItem>
      </MenuPopup>
    </Menu>
  )
}
