import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import {
  IconCards,
  IconChevronDown,
  IconHelpCircle,
  IconLogout,
  IconMessageCircle,
  IconUserCircle,
} from '@tabler/icons-react'
import { Button } from '../ui/button'

export function AccountDropdown() {
  return (
    <Menu>
      <MenuTrigger>
        <Button variant='ghost' size='icon'>
          <IconChevronDown />
        </Button>
      </MenuTrigger>
      <MenuPopup align='start' sideOffset={4}>
        <MenuItem>
          <IconUserCircle />
          Profile
        </MenuItem>
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
