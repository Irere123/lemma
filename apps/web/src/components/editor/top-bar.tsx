import {
  CalendarClock,
  Download,
  ExternalLink,
  History,
  Keyboard,
  Loader2,
  MoreHorizontal,
  Undo2,
} from 'lucide-react'
import type { Ref } from 'react'

import type { DocumentSync } from '@/lib/collab/document-sync'
import { cn } from '@/lib/utils'
import { BackNavigationButton } from '../navigation/back-navigation-button'
import { Button } from '../ui/button'
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '../ui/menu'
import { Popover, PopoverPopup, PopoverTrigger } from '../ui/popover'
import { Tooltip, TooltipPopup, TooltipTrigger } from '../ui/tooltip'
import { SaveIndicator } from './save-indicator'

export type DocumentStats = { words: number; characters: number }

// Average silent reading speed for non-fiction prose.
const WORDS_PER_MINUTE = 238

export type EditorTopBarProps = {
  sync: DocumentSync
  stats: DocumentStats
  status?: 'DRAFT' | 'PUBLISHED'
  isStatusUpdating?: boolean
  /** The public post, once published. */
  viewUrl?: string | null
  disabled?: boolean
  onPublish?: () => void
  onUnpublish?: () => void
  onOpenHistory: () => void
  onOpenSettings: () => void
  onOpenShortcuts: () => void
  onExportMarkdown?: () => void
  /** The bar fades while the writer types (see `data-idle` in app.css). */
  barRef?: Ref<HTMLElement>
}

function IconButton({
  label,
  shortcut,
  onClick,
  children,
}: {
  label: string
  shortcut?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            className='text-muted-foreground hover:text-foreground'
            onClick={onClick}
            aria-label={label}
          >
            {children}
          </Button>
        }
      />
      <TooltipPopup>
        {label}
        {shortcut ? <span className='ms-2 text-muted-foreground'>{shortcut}</span> : null}
      </TooltipPopup>
    </Tooltip>
  )
}

/**
 * The writing page's one bar: where you are, whether it's saved, and the
 * document's actions. Everything else stays out of the way of the text.
 */
export function EditorTopBar({
  sync,
  stats,
  status,
  isStatusUpdating = false,
  viewUrl,
  disabled = false,
  onPublish,
  onUnpublish,
  onOpenHistory,
  onOpenSettings,
  onOpenShortcuts,
  onExportMarkdown,
  barRef,
}: EditorTopBarProps) {
  const published = status === 'PUBLISHED'
  const minutes = Math.max(1, Math.round(stats.words / WORDS_PER_MINUTE))

  return (
    <header
      ref={barRef}
      className='editor-top-bar sticky top-0 z-40 border-border/60 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75'
    >
      <div className='mx-auto flex h-13 w-full max-w-5xl items-center gap-2 px-3 md:px-5'>
        <BackNavigationButton label='Documents' className='text-muted-foreground' />
        {status ? (
          <span
            className={cn(
              'hidden rounded-full px-2 py-0.5 font-medium text-xs sm:inline-flex',
              published
                ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {published ? 'Published' : 'Draft'}
          </span>
        ) : null}

        <div className='ms-auto flex items-center gap-1 text-muted-foreground text-xs'>
          <span className='me-1 inline-flex max-w-36 items-center gap-1.5 truncate sm:max-w-none'>
            <SaveIndicator sync={sync} />
          </span>
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type='button'
                  className='hidden rounded-md px-1.5 py-1 tabular-nums hover:bg-accent hover:text-foreground sm:inline-flex'
                  aria-label={`${stats.words.toLocaleString()} words, details`}
                >
                  {stats.words.toLocaleString()} {stats.words === 1 ? 'word' : 'words'}
                </button>
              }
            />
            <PopoverPopup className='w-56' side='bottom' align='end'>
              <dl className='grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm'>
                <dt className='text-muted-foreground'>Words</dt>
                <dd className='text-end tabular-nums'>{stats.words.toLocaleString()}</dd>
                <dt className='text-muted-foreground'>Characters</dt>
                <dd className='text-end tabular-nums'>{stats.characters.toLocaleString()}</dd>
                <dt className='text-muted-foreground'>Reading time</dt>
                <dd className='text-end tabular-nums'>{minutes} min</dd>
              </dl>
            </PopoverPopup>
          </Popover>

          <IconButton label='Version history' onClick={onOpenHistory}>
            <History />
          </IconButton>

          <Menu>
            <MenuTrigger
              render={
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  className='text-muted-foreground hover:text-foreground'
                  aria-label='More actions'
                >
                  <MoreHorizontal />
                </Button>
              }
            />
            <MenuPopup align='end' className='min-w-56'>
              <MenuItem onClick={onOpenSettings} disabled={disabled}>
                <CalendarClock />
                Publishing date…
              </MenuItem>
              {onExportMarkdown ? (
                <MenuItem onClick={onExportMarkdown}>
                  <Download />
                  Export as Markdown
                </MenuItem>
              ) : null}
              <MenuItem onClick={onOpenShortcuts}>
                <Keyboard />
                Keyboard shortcuts
              </MenuItem>
              {published && onUnpublish ? (
                <>
                  <MenuSeparator />
                  <MenuItem onClick={onUnpublish} disabled={disabled || isStatusUpdating}>
                    <Undo2 />
                    Unpublish
                  </MenuItem>
                </>
              ) : null}
            </MenuPopup>
          </Menu>

          {published ? (
            viewUrl ? (
              <Button
                size='sm'
                variant='outline'
                className='ms-1'
                render={
                  // biome-ignore lint/a11y/useAnchorContent: content comes from children
                  <a href={viewUrl} target='_blank' rel='noreferrer' />
                }
              >
                View post
                <ExternalLink />
              </Button>
            ) : null
          ) : onPublish ? (
            <Button
              type='button'
              size='sm'
              className='ms-1'
              onClick={onPublish}
              disabled={disabled || isStatusUpdating}
            >
              {isStatusUpdating ? <Loader2 className='animate-spin' /> : null}
              Publish
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
