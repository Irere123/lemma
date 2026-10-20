import { createUndoManager } from '@lemma/content/yjs'
import {
  EditorBubble,
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandGroup,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  EditorRoot,
  handleCommandNavigation,
  handleImageDrop,
  handleImagePaste,
} from '@lemma/headless'
import type { Editor } from '@tiptap/core'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { CalendarClock, X } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { DocumentSync } from '@/lib/collab/document-sync'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'
import { BlockHandle } from './block-handle'
import { ImageToolbar, TableToolbar } from './block-toolbars'
import { Cover } from './cover'
import { createEditorExtensions } from './extensions'
import { uploadImage } from './image-upload'
import { LinkBubble } from './link-bubble'
import { LinkDialog } from './link-dialog'
import { MathDialog, type MathEdit } from './math-dialog'
import { MobileToolbar } from './mobile-toolbar'
import { ColorSelector } from './selectors/color-selector'
import { LinkSelector } from './selectors/link-selector'
import { NodeSelector } from './selectors/node-selector'
import { TextButtons } from './selectors/text-buttons'
import { ShortcutsDialog } from './shortcuts-dialog'
import { suggestionItems } from './slash-command'
import { TitleFields } from './title-fields'
import { type DocumentStats, EditorTopBar } from './top-bar'
import { VersionHistory } from './version-history'

const formatDatetimeLocalValue = (value?: Date | string | null) => {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (part: number) => part.toString().padStart(2, '0')

  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-') +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

const parseDatetimeLocalValue = (value: string): Date | null | undefined => {
  if (!value) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

// Module-level so its identity never changes (see EditorBubble in @lemma/headless).
const BUBBLE_OPTIONS = { placement: 'top', offset: 8, flip: {}, shift: { padding: 8 } } as const

// The slash menu's sections, in the order their first item appears.
const SLASH_GROUPS = (() => {
  const groups = new Map<string, typeof suggestionItems>()
  for (const item of suggestionItems) {
    const group = item.group ?? 'Other'
    groups.set(group, [...(groups.get(group) ?? []), item])
  }
  return [...groups]
})()

// Counting walks the whole document, so it waits for a pause in typing.
const STATS_DELAY_MS = 800

function documentStats(editor: Editor): DocumentStats {
  const { doc } = editor.state
  const text = doc.textBetween(0, doc.content.size, '\n', ' ')
  return {
    words: text.match(/\S+/g)?.length ?? 0,
    characters: text.replace(/\n/g, '').length,
  }
}

// Keys that mean "the writer is typing": the bar fades until the mouse moves.
const isTypingKey = (event: KeyboardEvent) =>
  !event.metaKey &&
  !event.ctrlKey &&
  !event.altKey &&
  (event.key.length === 1 || event.key === 'Enter' || event.key === 'Backspace')

// Opened from a "link to block": scroll to it and mark it for a moment.
function revealLinkedBlock(editor: Editor) {
  const id = decodeURIComponent(window.location.hash.slice(1))
  if (!/^[a-z][a-z0-9]{5,31}$/.test(id)) return
  requestAnimationFrame(() => {
    const element = editor.view.dom.querySelector<HTMLElement>(`[data-id="${id}"]`)
    if (!element) return
    element.scrollIntoView({ block: 'center' })
    element.classList.add('is-linked-block')
    setTimeout(() => element.classList.remove('is-linked-block'), 2400)
  })
}

type AdvancedEditorProps = {
  sync: DocumentSync
  bannerImage?: string | null
  publishedDate?: Date | string | null
  isBannerUploading?: boolean
  disabled?: boolean
  className?: string
  status?: 'DRAFT' | 'PUBLISHED'
  isStatusUpdating?: boolean
  viewUrl?: string | null
  onPublish?: () => void
  onUnpublish?: () => void
  onBannerImageSelect?: (file: File) => void
  onBannerImageRemove?: () => void
  onPublishedDateChange?: (value: Date | null) => void
  onExportMarkdown?: () => void
}

const AdvancedEditor = ({
  sync,
  className,
  disabled = false,
  isBannerUploading = false,
  status,
  isStatusUpdating,
  viewUrl,
  onPublish,
  onUnpublish,
  onBannerImageRemove,
  onBannerImageSelect,
  onPublishedDateChange,
  onExportMarkdown,
  bannerImage,
  publishedDate,
}: AdvancedEditorProps) => {
  const editorRef = useRef<Editor | null>(null)
  const statsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const barRef = useRef<HTMLElement>(null)
  const [stats, setStats] = useState<DocumentStats>({ words: 0, characters: 0 })
  const [openNode, setOpenNode] = useState(false)
  const [openColor, setOpenColor] = useState(false)
  const [openLink, setOpenLink] = useState(false)
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
  const [isPublishingSettingsOpen, setIsPublishingSettingsOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [mathEdit, setMathEdit] = useState<MathEdit | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const subtitleRef = useRef<HTMLTextAreaElement>(null)

  // One undo history for the title, subtitle and body.
  const undoManager = useMemo(() => createUndoManager(sync.doc), [sync])

  // Undo/redo moves the caret to where the change was.
  useEffect(() => {
    const onPopped = ({ changedParentTypes }: { changedParentTypes: Map<unknown, unknown> }) => {
      const active = document.activeElement
      if (changedParentTypes.has(sync.title)) titleRef.current?.focus()
      else if (changedParentTypes.has(sync.subtitle)) subtitleRef.current?.focus()
      else if (active === titleRef.current || active === subtitleRef.current) {
        editorRef.current?.commands.focus()
      }
    }
    undoManager.on('stack-item-popped', onPopped)
    return () => {
      undoManager.off('stack-item-popped', onPopped)
    }
  }, [sync, undoManager])

  // The bar comes back as soon as the pointer moves (a few pixels, so a
  // resting hand on the trackpad doesn't count).
  useEffect(() => {
    let last: { x: number; y: number } | null = null
    const onMove = (event: PointerEvent) => {
      const bar = barRef.current
      const moved = last
        ? Math.abs(event.clientX - last.x) + Math.abs(event.clientY - last.y)
        : Number.POSITIVE_INFINITY
      last = { x: event.clientX, y: event.clientY }
      if (bar?.dataset.idle === 'true' && moved > 8) delete bar.dataset.idle
    }
    // ⌘/ opens the shortcuts from anywhere on the page.
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault()
        setIsShortcutsOpen(true)
      }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  // Moving between fields starts a new undo step.
  const stopCapturing = useCallback(() => undoManager.stopCapturing(), [undoManager])

  // Links to a block: the published post's anchor once it's public, else this
  // page (which scrolls to the block on open).
  const blockUrl = useCallback(
    (id: string) =>
      `${window.location.origin}${viewUrl ?? `/write/${sync.documentId}`}#${encodeURIComponent(id)}`,
    [sync.documentId, viewUrl]
  )

  const focusBodyStart = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    // Focus now: Tiptap's focus() waits a frame, and a key typed right after
    // Enter would land in the subtitle.
    editor.view.focus()
    editor.chain().focus('start').scrollIntoView().run()
  }, [])

  const extensions = useMemo(
    () =>
      createEditorExtensions({
        doc: sync.doc,
        undoManager,
        onEditMath: setMathEdit,
        onOpenLink: () => setOpenLink(true),
        onDroppedImages: (count) =>
          toast.warning(
            count === 1
              ? "1 image couldn't be pasted: it only exists on the computer it came from. Drag the image file in instead."
              : `${count} images couldn't be pasted: they only exist on the computer they came from. Drag the image files in instead.`
          ),
      }),
    [sync, undoManager]
  )

  const scheduleStats = useCallback((editor: Editor) => {
    if (statsTimer.current) clearTimeout(statsTimer.current)
    statsTimer.current = setTimeout(() => {
      const run = () => setStats(documentStats(editor))
      if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2000 })
      else run()
    }, STATS_DELAY_MS)
  }, [])

  const publishedDateValue = formatDatetimeLocalValue(publishedDate)

  const handlePublishedDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextPublishedDate = parseDatetimeLocalValue(event.currentTarget.value)
    if (nextPublishedDate === undefined) return

    onPublishedDateChange?.(nextPublishedDate)
  }

  const saveMath = (edit: MathEdit, latex: string) => {
    const editor = editorRef.current
    const chain = editor?.chain().focus()
    if (!editor || !chain) return
    if (edit.isNew) {
      const pos = Math.min(edit.pos, editor.state.doc.content.size)
      chain
        .insertContentAt(pos, { type: edit.display ? 'blockMath' : 'inlineMath', attrs: { latex } })
        .command(({ tr, state }) => {
          // Keep writing below a new display equation, not on top of it (a
          // selected equation would be replaced by the next keystroke).
          if (!(tr.selection instanceof NodeSelection)) return true
          const end = tr.selection.to
          if (!tr.doc.resolve(end).nodeAfter?.isTextblock) {
            tr.insert(end, state.schema.nodes.paragraph.create())
          }
          tr.setSelection(TextSelection.create(tr.doc, end + 1))
          return true
        })
        .run()
    } else if (edit.display) chain.updateBlockMath({ latex, pos: edit.pos }).run()
    else chain.updateInlineMath({ latex, pos: edit.pos }).run()
    setMathEdit(null)
  }

  const deleteMath = (edit: MathEdit) => {
    const chain = editorRef.current?.chain().focus()
    if (!chain) return
    if (edit.isNew) {
      setMathEdit(null)
      return
    }
    if (edit.display) chain.deleteBlockMath({ pos: edit.pos }).run()
    else chain.deleteInlineMath({ pos: edit.pos }).run()
    setMathEdit(null)
  }

  // Stable so the editor isn't handed new props (and re-configured) on re-render.
  const editorProps = useMemo(
    () => ({
      handleDOMEvents: {
        keydown: (_view: unknown, event: KeyboardEvent) => {
          // A DOM write, not React state: no re-render while typing.
          const bar = barRef.current
          if (bar && isTypingKey(event) && bar.dataset.idle !== 'true') bar.dataset.idle = 'true'
          return handleCommandNavigation(event)
        },
        focus: () => {
          stopCapturing()
          return false
        },
      },
      // ↑ on the first line of the body goes back to the subtitle.
      handleKeyDown: (view: EditorView, event: KeyboardEvent) => {
        if (event.key !== 'ArrowUp' || event.shiftKey || event.metaKey || event.ctrlKey) {
          return false
        }
        const { selection, doc } = view.state
        const first = doc.firstChild
        if (!selection.empty || !first?.isTextblock || selection.from > first.nodeSize - 1) {
          return false
        }
        if (!view.endOfTextblock('up')) return false
        event.preventDefault()
        const field = subtitleRef.current
        field?.focus()
        field?.setSelectionRange(field.value.length, field.value.length)
        return true
      },
      handlePaste: (view: EditorView, event: ClipboardEvent) =>
        handleImagePaste(view, event, uploadImage),
      handleDrop: (view: EditorView, event: DragEvent, _slice: unknown, moved: boolean) =>
        handleImageDrop(view, event, moved, uploadImage),
      // Keep the caret clear of the sticky bar and the screen's bottom edge.
      scrollMargin: { top: 96, bottom: 120, left: 0, right: 0 },
      scrollThreshold: { top: 96, bottom: 120, left: 0, right: 0 },
      attributes: {
        class: 'writer-prose focus:outline-none',
        spellcheck: 'true',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Document body',
      },
    }),
    [stopCapturing]
  )

  return (
    <div className={cn('writer-editor min-h-dvh', className)}>
      <EditorTopBar
        barRef={barRef}
        sync={sync}
        stats={stats}
        status={status}
        isStatusUpdating={isStatusUpdating}
        viewUrl={viewUrl}
        disabled={disabled}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={() => setIsPublishingSettingsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onExportMarkdown={onExportMarkdown}
      />

      <Dialog open={isPublishingSettingsOpen} onOpenChange={setIsPublishingSettingsOpen}>
        <DialogPopup className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Publishing date</DialogTitle>
            <DialogDescription>
              The date readers, feeds and your post list show for this post.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className='space-y-3'>
            <label className='flex items-center gap-2 font-medium text-sm' htmlFor='published-date'>
              <CalendarClock className='size-4 text-muted-foreground' />
              Published date
            </label>
            <div className='flex items-center gap-2'>
              <Input
                id='published-date'
                nativeInput
                type='datetime-local'
                value={publishedDateValue}
                onChange={handlePublishedDateChange}
                disabled={disabled}
                size='lg'
              />
              {publishedDateValue ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={() => onPublishedDateChange?.(null)}
                  disabled={disabled}
                  aria-label='Clear published date'
                >
                  <X />
                </Button>
              ) : null}
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button type='button' onClick={() => setIsPublishingSettingsOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <VersionHistory
        documentId={sync.documentId}
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
      />

      <ShortcutsDialog open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />

      <MathDialog
        edit={mathEdit}
        onClose={() => {
          setMathEdit(null)
          editorRef.current?.commands.focus()
        }}
        onSave={saveMath}
        onDelete={deleteMath}
      />

      <main className='writer-column group/doc pt-10 md:pt-16'>
        <Cover
          image={bannerImage}
          uploading={isBannerUploading}
          disabled={disabled}
          onSelect={onBannerImageSelect}
          onRemove={onBannerImageRemove}
        />

        <TitleFields
          sync={sync}
          undoManager={undoManager}
          disabled={disabled}
          titleRef={titleRef}
          subtitleRef={subtitleRef}
          onExitToBody={focusBodyStart}
        />

        <EditorRoot>
          <EditorContent
            extensions={extensions}
            className='relative'
            immediatelyRender={false}
            editable={!disabled}
            editorProps={editorProps}
            onCreate={({ editor }) => {
              editorRef.current = editor
              setStats(documentStats(editor))
              revealLinkedBlock(editor)
            }}
            onUpdate={({ editor, transaction }) => {
              if (transaction.docChanged) scheduleStats(editor)
            }}
            onDestroy={() => {
              if (statsTimer.current) clearTimeout(statsTimer.current)
              editorRef.current = null
            }}
          >
            <EditorCommand className='slash-menu z-50 max-h-[min(22rem,60vh)] w-80 overflow-y-auto rounded-xl border border-border/80 bg-popover p-1 shadow-xl'>
              <EditorCommandEmpty className='px-3 py-6 text-center text-muted-foreground text-sm'>
                No blocks match
              </EditorCommandEmpty>
              <EditorCommandList>
                {SLASH_GROUPS.map(([group, items]) => (
                  <EditorCommandGroup key={group} heading={group}>
                    {items.map((item) => (
                      <EditorCommandItem
                        key={item.title}
                        value={item.title}
                        keywords={item.searchTerms}
                        onCommand={(val) => item.command?.(val)}
                        className='flex w-full cursor-default items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm aria-selected:bg-accent'
                      >
                        <span className='flex size-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground [&_svg]:size-4'>
                          {item.icon}
                        </span>
                        <span className='min-w-0 flex-1'>
                          <span className='block font-medium leading-5'>{item.title}</span>
                          <span className='block truncate text-muted-foreground text-xs'>
                            {item.description}
                          </span>
                        </span>
                        {item.shortcut ? (
                          <kbd className='ms-2 shrink-0 rounded border border-border/70 px-1 font-mono text-[0.7rem] text-muted-foreground'>
                            {item.shortcut}
                          </kbd>
                        ) : null}
                      </EditorCommandItem>
                    ))}
                  </EditorCommandGroup>
                ))}
              </EditorCommandList>
            </EditorCommand>
            <BlockHandle blockUrl={blockUrl} />
            <LinkBubble onEdit={() => setOpenLink(true)} />
            <ImageToolbar />
            <TableToolbar />
            <MobileToolbar onLink={() => setIsLinkDialogOpen(true)} />
            <LinkDialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen} />
            <EditorBubble
              options={BUBBLE_OPTIONS}
              className='editor-bubble flex w-fit max-w-[92vw] items-center overflow-hidden rounded-xl border border-border/80 bg-popover shadow-xl'
            >
              <NodeSelector open={openNode} onOpenChange={setOpenNode} />
              <Separator orientation='vertical' />
              <TextButtons />
              <Separator orientation='vertical' />
              <LinkSelector open={openLink} onOpenChange={setOpenLink} />
              <Separator orientation='vertical' />
              <ColorSelector open={openColor} onOpenChange={setOpenColor} />
            </EditorBubble>
          </EditorContent>
        </EditorRoot>
      </main>
    </div>
  )
}

export default memo(AdvancedEditor)
