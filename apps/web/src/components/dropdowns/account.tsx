import {
  IconCards,
  IconChevronDown,
  IconHelpCircle,
  IconLogout,
  IconMessageCircle,
  IconUserCircle,
} from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import type { ComponentProps, ReactElement, ReactNode } from 'react'

import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
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
      <MenuPopup align={align} side={side} sideOffset={4}>
        <MenuItem
          render={
            <Link to='/u/$username' params={{ username: 'profile' }}>
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
        <MenuItem>
          <IconLogout /> Logout
        </MenuItem>
      </MenuPopup>
    </Menu>
  )
}
