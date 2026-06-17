import {
  IconAlignJustified,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLoader2,
  IconPlus,
  IconSearch,
  IconSelector,
  IconSettings,
} from '@tabler/icons-react'
import { Link, useLocation } from '@tanstack/react-router'
import type { ReactElement, ReactNode } from 'react'
import { useEffect } from 'react'

import { useCreateDocument } from '@/hooks/use-create-document'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { useCommandPaletteStore } from '@/stores/command-palette'
import { useSidebarStore } from '@/stores/sidebar-store'
import { AccountDropdown } from './dropdowns/account'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Skeleton } from './ui/skeleton'
import { Tooltip, TooltipPopup, TooltipTrigger } from './ui/tooltip'

// Single, predictable rule for highlighting a link. Leaf routes match exactly
// so `/app` no longer lights up on `/app/search` or `/app/settings`; parent
// routes (e.g. `/app/settings`) also match their nested children.
function useIsActive(href: string, exact: boolean) {
  const pathname = useLocation({ select: (location) => location.pathname })
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function Sidebar() {
  const { data: session, isPending } = useSession()
  const expanded = useSidebarStore((state) => state.expanded)
  const toggle = useSidebarStore((state) => state.toggle)

  // Persisted state is read on the client only (see sidebar-store) to keep SSR
  // and the first paint deterministic. Rehydrate once mounted.
  useEffect(() => {
    useSidebarStore.persist.rehydrate()
  }, [])

  const widthClass = expanded ? 'w-60' : 'w-16'

  return (
    <>
      {/*
        In-flow spacer that reserves the sidebar's footprint and pushes the page
        content. It is empty, so animating its width is cheap — the browser never
        has to reflow the sidebar's own items frame-by-frame (those live in the
        fixed panel below, whose width animation only touches its small subtree).
      */}
      <div
        aria-hidden
        className={cn(
          'hidden shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none md:block',
          widthClass
        )}
      />
      <nav
        aria-label='Primary'
        data-expanded={expanded ? 'true' : undefined}
        className={cn(
          'fixed inset-y-0 left-0 z-50 hidden flex-col gap-2 overflow-hidden border-neutral-200 border-r bg-background px-2 py-2 transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex',
          widthClass
        )}
      >
        <div
          className={cn(
            'flex h-10 items-center border-neutral-200 border-b pb-2',
            expanded ? 'justify-between px-1' : 'justify-center'
          )}
        >
          {expanded && (
            <span className='truncate font-semibold text-base tracking-tight'>Lemma</span>
          )}
          <SidebarToggle expanded={expanded} onToggle={toggle} />
        </div>

        <div
          className={cn('flex flex-1 flex-col gap-1', expanded ? 'items-stretch' : 'items-center')}
        >
          <SidebarLink
            href='/app'
            exact
            icon={<IconAlignJustified size={20} />}
            label='Library'
            expanded={expanded}
          />
          <SidebarSearchButton expanded={expanded} />
          <SidebarCreateDocumentButton expanded={expanded} />
          <SidebarLink
            href='/app/settings'
            icon={<IconSettings size={20} />}
            label='Settings'
            expanded={expanded}
          />
        </div>

        <div
          className={cn(
            'flex border-neutral-200 border-t pt-2',
            expanded ? 'flex-col' : 'justify-center'
          )}
        >
          {isPending ? (
            <Skeleton className='size-9 shrink-0 rounded-full' />
          ) : (
            <AccountDropdown
              side='top'
              align='start'
              triggerClassName={cn(
                'group/item flex items-center text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-[0.96]',
                expanded
                  ? 'w-full gap-2 rounded-lg p-1 text-left'
                  : 'size-10 justify-center rounded-full'
              )}
            >
              <Avatar className='size-9 shrink-0 rounded-full'>
                <AvatarImage alt='User' src={session?.user?.image ?? undefined} />
                <AvatarFallback>{session?.user?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              {expanded && (
                <>
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate font-medium text-foreground text-sm'>
                      {session?.user?.name}
                    </span>
                    <span className='block truncate text-muted-foreground text-xs'>
                      {session?.user?.email}
                    </span>
                  </span>
                  <IconSelector size={16} className='shrink-0 opacity-70' />
                </>
              )}
            </AccountDropdown>
          )}
        </div>
      </nav>
    </>
  )
}

export function SidebarCreateDocumentButton({
  className,
  expanded = false,
}: {
  className?: string
  expanded?: boolean
}) {
  const { createDocument, isPending } = useCreateDocument()

  const button = (
    <button
      type='button'
      className={cn(
        itemClassName(expanded),
        'disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      onClick={createDocument}
      disabled={isPending}
      aria-label='Create new document'
    >
      <span className='flex size-10 shrink-0 items-center justify-center'>
        {isPending ? <IconLoader2 size={20} className='animate-spin' /> : <IconPlus size={20} />}
      </span>
      {expanded && <span className='truncate text-sm'>New document</span>}
    </button>
  )

  if (expanded) {
    return button
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button as ReactElement<Record<string, unknown>>} />
      <TooltipPopup side='right'>Create document</TooltipPopup>
    </Tooltip>
  )
}

// Compact icon toggle that lives in the header. Always renders as an icon
// button (with a tooltip) so it stays tidy next to the wordmark when expanded
// and centered in the rail when collapsed.
function SidebarToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const label = expanded ? 'Collapse sidebar' : 'Expand sidebar'

  const button = (
    <button
      type='button'
      onClick={onToggle}
      aria-label={label}
      aria-expanded={expanded}
      className='group/item flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-[0.96]'
    >
      {expanded ? (
        <IconLayoutSidebarLeftCollapse size={20} />
      ) : (
        <IconLayoutSidebarLeftExpand size={20} />
      )}
    </button>
  )

  return (
    <Tooltip>
      <TooltipTrigger render={button as ReactElement<Record<string, unknown>>} />
      <TooltipPopup side='right'>{label}</TooltipPopup>
    </Tooltip>
  )
}

// Opens the command palette instead of navigating. Mirrors the link styling so
// it sits naturally among the nav items, with a ⌘K hint when expanded.
function SidebarSearchButton({ expanded }: { expanded: boolean }) {
  const setOpen = useCommandPaletteStore((state) => state.setOpen)

  const button = (
    <button
      type='button'
      onClick={() => setOpen(true)}
      aria-label='Search'
      className={itemClassName(expanded)}
    >
      <span className='flex size-10 shrink-0 items-center justify-center'>
        <IconSearch size={20} />
      </span>
      {expanded && (
        <>
          <span className='flex-1 truncate text-left text-sm'>Search</span>
          <kbd className='pointer-events-none rounded border bg-muted px-1.5 py-0.5 font-medium font-sans text-[10px] text-muted-foreground'>
            ⌘K
          </kbd>
        </>
      )}
    </button>
  )

  if (expanded) {
    return button
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button as ReactElement<Record<string, unknown>>} />
      <TooltipPopup side='right'>Search</TooltipPopup>
    </Tooltip>
  )
}

// Shared geometry so links, the create button, and the toggle stay perfectly
// aligned in both the collapsed rail and the expanded panel.
function itemClassName(expanded: boolean, isActive = false) {
  return cn(
    'group/item flex h-10 items-center text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-[0.96]',
    expanded ? 'w-full justify-start rounded-lg pr-3' : 'size-10 justify-center rounded-full',
    isActive && 'bg-muted font-medium text-foreground'
  )
}

const SidebarLink = ({
  icon,
  href,
  label,
  exact = false,
  expanded,
  className,
}: {
  icon: ReactNode
  href: string
  label: string
  exact?: boolean
  expanded: boolean
  className?: string
}) => {
  const isActive = useIsActive(href, exact)

  const link = (
    <Link
      to={href}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      data-active={isActive ? 'true' : undefined}
      className={cn(itemClassName(expanded, isActive), className)}
    >
      <span className='flex size-10 shrink-0 items-center justify-center'>{icon}</span>
      {expanded && <span className='truncate text-sm'>{label}</span>}
    </Link>
  )

  if (expanded) {
    return link
  }

  return (
    <Tooltip>
      <TooltipTrigger render={link as ReactElement<Record<string, unknown>>} />
      <TooltipPopup side='right'>{label}</TooltipPopup>
    </Tooltip>
  )
}
