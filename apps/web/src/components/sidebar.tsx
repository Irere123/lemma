import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import {
  BookMarked,
  BookOpen,
  ChevronsUpDown,
  FileText,
  Home,
  Library,
  Loader2,
  Mail,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
} from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'
import { useEffect } from 'react'

import { useCreate } from '@/hooks/use-create'
import { useSession } from '@/lib/auth-client'
import { isMac } from '@/lib/keys'
import { cn } from '@/lib/utils'
import { useCommandPaletteStore } from '@/stores/command-palette'
import { useSidebarStore } from '@/stores/sidebar-store'
import { useTRPC } from '@/trpc/client'
import { AccountDropdown } from './dropdowns/account'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Kbd, KbdGroup } from './ui/kbd'
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuShortcut, MenuTrigger } from './ui/menu'
import { Skeleton } from './ui/skeleton'
import { Tooltip, TooltipPopup, TooltipTrigger } from './ui/tooltip'

// Leaf routes match exactly so `/app` doesn't light up on `/app/posts`;
// sections (e.g. `/app/books`) also match their children.
function useIsActive(href: string, exact: boolean) {
  const pathname = useLocation({ select: (location) => location.pathname })
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

const row =
  'group/row flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13.5px] text-sidebar-foreground/85 outline-none transition-[background-color,color] duration-100 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-sidebar-foreground/60 hover:[&_svg]:text-sidebar-accent-foreground'
const rail =
  'flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/70 outline-none transition-[background-color,color] duration-100 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-[18px]'
const activeRow =
  'bg-sidebar-accent font-medium text-sidebar-accent-foreground [&_svg]:text-sidebar-accent-foreground'

/** In the collapsed rail every item is an icon with a tooltip. */
function WithTooltip({
  show,
  label,
  children,
}: {
  show: boolean
  label: string
  children: ReactElement
}) {
  if (!show) return children
  return (
    <Tooltip>
      <TooltipTrigger render={children as ReactElement<Record<string, unknown>>} />
      <TooltipPopup side='right'>{label}</TooltipPopup>
    </Tooltip>
  )
}

function NavLink({
  href,
  icon,
  label,
  exact = false,
  expanded,
  trailing,
}: {
  href: string
  icon: ReactNode
  label: string
  exact?: boolean
  expanded: boolean
  trailing?: ReactNode
}) {
  const active = useIsActive(href, exact)
  return (
    <WithTooltip show={!expanded} label={label}>
      <Link
        to={href}
        aria-label={expanded ? undefined : label}
        aria-current={active ? 'page' : undefined}
        className={cn(expanded ? row : rail, active && activeRow)}
      >
        {icon}
        {expanded ? <span className='flex-1 truncate'>{label}</span> : null}
        {expanded ? trailing : null}
      </Link>
    </WithTooltip>
  )
}

function Section({
  title,
  expanded,
  children,
}: {
  title: string
  expanded: boolean
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-px', expanded ? 'mt-5' : 'mt-3 items-center')}>
      {expanded ? (
        <p className='px-2 pb-1 font-medium text-[11px] text-sidebar-foreground/50 uppercase tracking-[0.08em]'>
          {title}
        </p>
      ) : (
        <div className='mx-auto mb-2 h-px w-5 bg-sidebar-border' />
      )}
      {children}
    </div>
  )
}

export function Sidebar() {
  const { data: session, isPending } = useSession()
  const expanded = useSidebarStore((state) => state.expanded)
  const toggle = useSidebarStore((state) => state.toggle)
  const openPalette = useCommandPaletteStore((state) => state.setOpen)
  const create = useCreate()

  // Persisted state is read on the client only (see sidebar-store), so SSR
  // and the first paint agree. Rehydrate once mounted.
  useEffect(() => {
    useSidebarStore.persist.rehydrate()
  }, [])

  const width = expanded ? 'w-[15rem]' : 'w-[3.75rem]'
  const mod = isMac() ? '⌘' : 'Ctrl'

  return (
    <>
      {/* Reserves the sidebar's width in the page flow; animating this empty
          box is cheap, and the fixed panel below never reflows its items. */}
      <div
        aria-hidden
        className={cn(
          'hidden shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none md:block',
          width
        )}
      />
      <nav
        aria-label='Workspace'
        data-expanded={expanded ? 'true' : undefined}
        className={cn(
          'fixed inset-y-0 left-0 z-50 hidden flex-col overflow-hidden border-sidebar-border border-r bg-sidebar transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex',
          width,
          expanded ? 'px-2.5' : 'items-center px-0'
        )}
      >
        <div
          className={cn(
            'flex h-13 shrink-0 items-center',
            expanded ? 'justify-between px-1' : 'justify-center'
          )}
        >
          {expanded ? (
            <Link
              to='/app'
              className='flex min-w-0 items-center gap-2 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring'
            >
              <span className='flex size-6 items-center justify-center rounded-md bg-sidebar-primary font-semibold text-[13px] text-sidebar-primary-foreground'>
                L
              </span>
              <span className='truncate font-semibold text-[15px] tracking-tight'>Lemma</span>
            </Link>
          ) : null}
          <WithTooltip show label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}>
            <button
              type='button'
              onClick={toggle}
              aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-expanded={expanded}
              className={cn(rail, 'size-8')}
            >
              {expanded ? <PanelLeftClose /> : <PanelLeftOpen />}
            </button>
          </WithTooltip>
        </div>

        <div className={cn('flex flex-col gap-1.5', !expanded && 'items-center')}>
          <WithTooltip show={!expanded} label='Search'>
            <button
              type='button'
              onClick={() => openPalette(true)}
              aria-label='Search'
              className={cn(
                expanded
                  ? 'flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border bg-background/60 px-2 text-[13px] text-muted-foreground shadow-surface outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring dark:bg-background/20 [&_svg]:size-3.5'
                  : rail
              )}
            >
              <Search />
              {expanded ? (
                <>
                  <span className='flex-1 text-left'>Search</span>
                  <KbdGroup>
                    <Kbd>{mod}</Kbd>
                    <Kbd>K</Kbd>
                  </KbdGroup>
                </>
              ) : null}
            </button>
          </WithTooltip>

          <Menu>
            <WithTooltip show={!expanded} label='New'>
              <MenuTrigger
                render={
                  <button
                    type='button'
                    aria-label='New'
                    disabled={create.isPending}
                    className={cn(
                      expanded
                        ? 'flex h-8 w-full items-center gap-2 rounded-md bg-sidebar-primary px-2 font-medium text-[13px] text-sidebar-primary-foreground shadow-xs outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 [&_svg]:size-4'
                        : cn(
                            rail,
                            'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground hover:brightness-110'
                          )
                    )}
                  >
                    {create.isPending ? <Loader2 className='animate-spin' /> : <Plus />}
                    {expanded ? <span className='flex-1 text-left'>New</span> : null}
                  </button>
                }
              />
            </WithTooltip>
            <MenuPopup side={expanded ? 'bottom' : 'right'} align='start' className='min-w-56'>
              <MenuItem onClick={create.createPost}>
                <FileText />
                Post
              </MenuItem>
              <MenuItem onClick={create.createNote}>
                <NotebookPen />
                Note
                <MenuShortcut>{isMac() ? '⌥⌘N' : 'Ctrl+Alt+N'}</MenuShortcut>
              </MenuItem>
              <MenuItem onClick={create.createBook}>
                <BookOpen />
                Book
              </MenuItem>
              <MenuSeparator />
              <MenuItem onClick={create.openToday}>
                <Sun />
                Today’s note
                <MenuShortcut>{isMac() ? '⌥⌘D' : 'Ctrl+Alt+D'}</MenuShortcut>
              </MenuItem>
            </MenuPopup>
          </Menu>
        </div>

        <div
          className={cn(
            'mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden',
            !expanded && 'items-center'
          )}
        >
          <div className={cn('flex flex-col gap-px', !expanded && 'items-center gap-1')}>
            <NavLink href='/app' exact icon={<Home />} label='Home' expanded={expanded} />
            <NavLink href='/app/posts' icon={<FileText />} label='Posts' expanded={expanded} />
            <NavLink href='/app/books' icon={<BookOpen />} label='Books' expanded={expanded} />
            <NavLink href='/app/notes' icon={<NotebookPen />} label='Notes' expanded={expanded} />
            <WithTooltip show={!expanded} label='Today’s note'>
              <button
                type='button'
                onClick={create.openToday}
                aria-label={expanded ? undefined : 'Today’s note'}
                className={expanded ? row : rail}
              >
                <Sun />
                {expanded ? <span className='flex-1 truncate text-left'>Today</span> : null}
              </button>
            </WithTooltip>
            <NavLink
              href='/app/references'
              icon={<Library />}
              label='References'
              expanded={expanded}
            />
          </div>

          {expanded ? <SidebarBooks /> : null}

          <Section title='Publishing' expanded={expanded}>
            <NavLink
              href='/app/newsletters'
              icon={<Mail />}
              label='Newsletters'
              expanded={expanded}
            />
            <NavLink
              href='/app/subscribers'
              icon={<Users />}
              label='Subscribers'
              expanded={expanded}
            />
          </Section>
        </div>

        <div
          className={cn(
            'flex shrink-0 flex-col gap-1 border-sidebar-border border-t py-2',
            !expanded && 'items-center'
          )}
        >
          <NavLink href='/app/settings' icon={<Settings />} label='Settings' expanded={expanded} />
          {isPending ? (
            <Skeleton className='size-8 rounded-full' />
          ) : (
            <AccountDropdown
              side='top'
              align='start'
              triggerClassName={cn(
                'flex items-center outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring',
                expanded
                  ? 'w-full gap-2 rounded-md p-1.5 text-left'
                  : 'size-9 justify-center rounded-lg'
              )}
            >
              <Avatar className='size-7 shrink-0 rounded-full'>
                <AvatarImage alt='' src={session?.user?.image ?? undefined} />
                <AvatarFallback className='text-xs'>
                  {session?.user?.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {expanded ? (
                <>
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate font-medium text-[13px] text-sidebar-foreground'>
                      {session?.user?.name}
                    </span>
                    <span className='block truncate text-[11.5px] text-muted-foreground'>
                      {session?.user?.email}
                    </span>
                  </span>
                  <ChevronsUpDown className='size-3.5 shrink-0 text-muted-foreground' />
                </>
              ) : null}
            </AccountDropdown>
          )}
        </div>
      </nav>
    </>
  )
}

/** The writer's books, with how far along each is. */
function SidebarBooks() {
  const trpc = useTRPC()
  const { data: books } = useQuery(trpc.books.list.queryOptions())
  if (!books || books.length === 0) return null
  return (
    <Section title='Books' expanded>
      {books.slice(0, 5).map((book) => {
        const progress = book.wordTarget ? Math.min(1, book.words / book.wordTarget) : null
        return (
          <Link
            key={book.id}
            to='/app/books/$bookId'
            params={{ bookId: book.id }}
            className={row}
            activeProps={{ className: activeRow }}
          >
            <BookMarked />
            <span className='flex-1 truncate'>{book.title || 'Untitled book'}</span>
            {progress !== null ? (
              <span className='text-[11px] text-muted-foreground tabular-nums'>
                {Math.round(progress * 100)}%
              </span>
            ) : null}
          </Link>
        )
      })}
    </Section>
  )
}
