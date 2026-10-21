import { STYLES, type StyleId } from '@lemma/content/citations'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  BookMarked,
  CalendarClock,
  Download,
  ExternalLink,
  FileText,
  FileType2,
  Focus,
  History,
  Keyboard,
  ListTree,
  Loader2,
  Merge,
  MoreHorizontal,
  NotebookPen,
  Search,
  Undo2,
} from 'lucide-react'
import { type ReactNode, type Ref, useEffect, useState } from 'react'

import type { DocumentSync } from '@/lib/collab/document-sync'
import { formatNumber } from '@/lib/format'
import { isMac } from '@/lib/keys'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from '../ui/menu'
import { Popover, PopoverPopup, PopoverTrigger } from '../ui/popover'
import { Tooltip, TooltipPopup, TooltipTrigger } from '../ui/tooltip'
import { Progress, ProgressRing } from '../workspace/progress'
import { SaveIndicator } from './save-indicator'

export type DocumentStats = { words: number; characters: number }

export type DocumentKind = 'post' | 'chapter' | 'part' | 'note'

// Average silent reading speed for non-fiction prose.
const WORDS_PER_MINUTE = 238

export type EditorTopBarProps = {
  sync: DocumentSync
  stats: DocumentStats
  kind: DocumentKind
  /** For a chapter: its book, and where it sits in it. */
  chapter?: { bookId: string; bookTitle: string; number: number | null } | null
  /** Words written in this document today (session target). */
  todayWords: number
  wordTarget?: number | null
  status?: 'DRAFT' | 'PUBLISHED'
  isStatusUpdating?: boolean
  /** The public post, once published. */
  viewUrl?: string | null
  disabled?: boolean
  citationStyle: StyleId
  onCitationStyle: (style: StyleId) => void
  focusMode: boolean
  onFocusMode: () => void
  onFind: () => void
  onToggleOutline?: () => void
  onPublish?: () => void
  onUnpublish?: () => void
  onTurnIntoPost?: () => void
  /** Chapters: append the next chapter to this one. */
  onMergeNext?: () => void
  onOpenHistory: () => void
  onOpenSettings: () => void
  onOpenShortcuts: () => void
  onExport: (format: 'markdown' | 'pandoc' | 'docx') => void
  /** The bar fades while the writer types (see `data-idle` in app.css). */
  barRef?: Ref<HTMLElement>
}

function IconButton({
  label,
  shortcut,
  onClick,
  active = false,
  children,
}: {
  label: string
  shortcut?: string
  onClick: () => void
  active?: boolean
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            className={cn(
              'text-muted-foreground hover:text-foreground',
              active && 'bg-accent text-foreground'
            )}
            onClick={onClick}
            aria-label={label}
            aria-pressed={active || undefined}
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

function BackLink({ kind, chapter }: Pick<EditorTopBarProps, 'kind' | 'chapter'>) {
  const className =
    'inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'
  if (kind === 'chapter' && chapter) {
    return (
      <Link to='/app/books/$bookId' params={{ bookId: chapter.bookId }} className={className}>
        <ArrowLeft className='size-3.5 shrink-0' />
        <span className='truncate'>{chapter.bookTitle || 'Book'}</span>
      </Link>
    )
  }
  if (kind === 'note') {
    return (
      <Link to='/app/notes' className={className}>
        <ArrowLeft className='size-3.5 shrink-0' /> Notes
      </Link>
    )
  }
  return (
    <Link to='/app/posts' className={className}>
      <ArrowLeft className='size-3.5 shrink-0' /> Posts
    </Link>
  )
}

/**
 * The writing page's one bar: where you are, whether it's saved, and the
 * document's actions. Everything else stays out of the way of the text.
 */
export function EditorTopBar(props: EditorTopBarProps) {
  const {
    sync,
    stats,
    kind,
    chapter,
    todayWords,
    wordTarget,
    status,
    isStatusUpdating = false,
    viewUrl,
    disabled = false,
    citationStyle,
    onCitationStyle,
    focusMode,
    onFocusMode,
    onFind,
    onToggleOutline,
    onPublish,
    onUnpublish,
    onTurnIntoPost,
    onMergeNext,
    onOpenHistory,
    onOpenSettings,
    onOpenShortcuts,
    onExport,
    barRef,
  } = props
  const published = status === 'PUBLISHED'
  const minutes = Math.max(1, Math.round(stats.words / WORDS_PER_MINUTE))
  const publishable = kind === 'post' || kind === 'chapter'
  const mod = isMac() ? '⌘' : 'Ctrl+'

  return (
    <header
      ref={barRef}
      className='editor-top-bar sticky top-0 z-40 border-border/50 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70'
    >
      <div className='mx-auto flex h-13 w-full max-w-6xl items-center gap-1.5 px-3 md:px-5'>
        {onToggleOutline ? (
          <IconButton label='Chapters and outline' onClick={onToggleOutline}>
            <ListTree />
          </IconButton>
        ) : null}
        <BackLink kind={kind} chapter={chapter} />
        {kind === 'chapter' && chapter?.number ? (
          <span className='hidden text-[12.5px] text-muted-foreground sm:inline'>
            · Chapter {chapter.number}
          </span>
        ) : null}
        {kind === 'note' ? (
          <span className='hidden items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-[11.5px] text-muted-foreground sm:inline-flex'>
            <NotebookPen className='size-3' /> Private note
          </span>
        ) : status ? (
          <span
            className={cn(
              'hidden rounded-full px-2 py-0.5 font-medium text-[11.5px] sm:inline-flex',
              published ? 'bg-success/12 text-success-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            {published ? 'Published' : 'Draft'}
          </span>
        ) : null}

        <div className='ms-auto flex items-center gap-0.5 text-[12.5px] text-muted-foreground'>
          <span className='me-1.5 inline-flex max-w-36 items-center gap-1.5 truncate sm:max-w-none'>
            <SaveIndicator sync={sync} />
          </span>
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type='button'
                  className='hidden items-center gap-1.5 rounded-md px-1.5 py-1 tabular-nums hover:bg-accent hover:text-foreground sm:inline-flex'
                  aria-label={`${stats.words.toLocaleString()} words, details`}
                >
                  {wordTarget ? <ProgressRing value={stats.words / wordTarget} size={15} /> : null}
                  {formatNumber(stats.words)} {stats.words === 1 ? 'word' : 'words'}
                </button>
              }
            />
            <PopoverPopup className='w-60' side='bottom' align='end'>
              <dl className='grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm'>
                <dt className='text-muted-foreground'>Words</dt>
                <dd className='text-end tabular-nums'>{formatNumber(stats.words)}</dd>
                <dt className='text-muted-foreground'>Written today</dt>
                <dd className='text-end tabular-nums'>+{formatNumber(todayWords)}</dd>
                {wordTarget ? (
                  <>
                    <dt className='text-muted-foreground'>Target</dt>
                    <dd className='text-end tabular-nums'>
                      {Math.min(100, Math.round((stats.words / wordTarget) * 100))}% of{' '}
                      {formatNumber(wordTarget)}
                    </dd>
                  </>
                ) : null}
                <dt className='text-muted-foreground'>Characters</dt>
                <dd className='text-end tabular-nums'>{formatNumber(stats.characters)}</dd>
                <dt className='text-muted-foreground'>Reading time</dt>
                <dd className='text-end tabular-nums'>{minutes} min</dd>
              </dl>
              <DailyGoal todayWords={todayWords} />
            </PopoverPopup>
          </Popover>

          <IconButton label='Find and replace' shortcut={`${mod}F`} onClick={onFind}>
            <Search />
          </IconButton>
          <IconButton
            label='Focus mode'
            shortcut={`${isMac() ? '⇧⌘' : 'Ctrl+Shift+'}F`}
            onClick={onFocusMode}
            active={focusMode}
          >
            <Focus />
          </IconButton>
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
            <MenuPopup align='end' className='min-w-60'>
              {kind === 'note' && onTurnIntoPost ? (
                <>
                  <MenuItem onClick={onTurnIntoPost} disabled={disabled}>
                    <FileText />
                    Turn into a post
                  </MenuItem>
                  <MenuSeparator />
                </>
              ) : null}
              {onMergeNext ? (
                <>
                  <MenuItem onClick={onMergeNext} disabled={disabled}>
                    <Merge />
                    Merge with next chapter
                  </MenuItem>
                  <MenuSeparator />
                </>
              ) : null}
              {publishable ? (
                <MenuItem onClick={onOpenSettings} disabled={disabled}>
                  <CalendarClock />
                  Publishing date…
                </MenuItem>
              ) : null}
              <MenuSub>
                <MenuSubTrigger>
                  <BookMarked />
                  Citation style
                </MenuSubTrigger>
                <MenuSubPopup className='min-w-48'>
                  <MenuRadioGroup
                    value={citationStyle}
                    onValueChange={(value) => onCitationStyle(value as StyleId)}
                  >
                    {STYLES.map((style) => (
                      <MenuRadioItem key={style.id} value={style.id} closeOnClick>
                        {style.label}
                      </MenuRadioItem>
                    ))}
                  </MenuRadioGroup>
                </MenuSubPopup>
              </MenuSub>
              <MenuSub>
                <MenuSubTrigger>
                  <Download />
                  Export
                </MenuSubTrigger>
                <MenuSubPopup className='min-w-60'>
                  <MenuItem onClick={() => onExport('docx')}>
                    <FileType2 /> Word document (.docx)
                  </MenuItem>
                  <MenuItem onClick={() => onExport('markdown')}>
                    <Download /> Markdown
                  </MenuItem>
                  <MenuItem onClick={() => onExport('pandoc')}>
                    <Download /> Pandoc / Quarto (with .bib)
                  </MenuItem>
                </MenuSubPopup>
              </MenuSub>
              <MenuItem onClick={onOpenShortcuts}>
                <Keyboard />
                Keyboard shortcuts
                <MenuShortcut>{mod}/</MenuShortcut>
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

          {!publishable ? null : published ? (
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
                View
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

const GOAL_KEY = 'lemma-daily-goal'

/** A daily writing goal (words written today), kept on this device. */
function DailyGoal({ todayWords }: { todayWords: number }) {
  const [goal, setGoal] = useState<number | null>(null)
  useEffect(() => {
    const stored = Number(localStorage.getItem(GOAL_KEY))
    setGoal(Number.isFinite(stored) && stored > 0 ? stored : null)
  }, [])
  const save = (value: string) => {
    const next = Number(value.replace(/[^\d]/g, ''))
    if (Number.isFinite(next) && next > 0) {
      localStorage.setItem(GOAL_KEY, String(next))
      setGoal(next)
    } else {
      localStorage.removeItem(GOAL_KEY)
      setGoal(null)
    }
  }
  return (
    <div className='mt-3 border-border/70 border-t pt-3'>
      <label className='flex items-center justify-between gap-3 text-sm'>
        <span className='text-muted-foreground'>Daily goal</span>
        <input
          inputMode='numeric'
          defaultValue={goal ?? ''}
          key={goal ?? 'none'}
          placeholder='500'
          aria-label='Daily goal in words'
          onBlur={(event) => save(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          className='h-7 w-20 rounded-md border border-input bg-background px-2 text-end text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring'
        />
      </label>
      {goal ? <Progress value={todayWords / goal} className='mt-2' label='Today’s goal' /> : null}
    </div>
  )
}
