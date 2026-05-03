import {
  EditorBubble,
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  EditorRoot,
  getAllContent,
  handleCommandNavigation,
  type JSONContent,
} from '@lemma/headless'
import { CalendarClock, ImagePlus, Loader2, Settings2, Trash2, Upload, X } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useRef, useState } from 'react'

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
import { defaultExtensions } from './extensions'
import { ColorSelector } from './selectors/color-selector'
import { LinkSelector } from './selectors/link-selector'
import { NodeSelector } from './selectors/node-selector'
import { slashCommand, suggestionItems } from './slash-command'

const extensions = [...defaultExtensions, slashCommand]

export type WriterEditorUpdate = {
  markdown: string
  words: number
}

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

type AdvancedEditorProps = {
  initialContent?: JSONContent | string
  title: string
  subtitle: string
  bannerImage?: string | null
  publishedDate?: Date | string | null
  isBannerUploading?: boolean
  saveStatus?: string
  disabled?: boolean
  className?: string
  onTitleChange: (value: string) => void
  onSubtitleChange: (value: string) => void
  onBannerImageSelect?: (file: File) => void
  onBannerImageRemove?: () => void
  onPublishedDateChange?: (value: Date | null) => void
  onContentChange?: (value: WriterEditorUpdate) => void
}

const AdvancedEditor = ({
  className,
  disabled = false,
  initialContent,
  isBannerUploading = false,
  onContentChange,
  onBannerImageRemove,
  onBannerImageSelect,
  onPublishedDateChange,
  onSubtitleChange,
  onTitleChange,
  saveStatus = 'Saved',
  bannerImage,
  publishedDate,
  subtitle,
  title,
}: AdvancedEditorProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [wordsCount, setWordsCount] = useState<number>(0)
  const [openNode, setOpenNode] = useState(false)
  const [openColor, setOpenColor] = useState(false)
  const [openLink, setOpenLink] = useState(false)
  const [isPublishingSettingsOpen, setIsPublishingSettingsOpen] = useState(false)

  const openFilePicker = () => fileInputRef.current?.click()

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    onBannerImageSelect?.(file)
    event.currentTarget.value = ''
  }

  const publishedDateValue = formatDatetimeLocalValue(publishedDate)

  const handlePublishedDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextPublishedDate = parseDatetimeLocalValue(event.currentTarget.value)
    if (nextPublishedDate === undefined) return

    onPublishedDateChange?.(nextPublishedDate)
  }

  return (
    <section
      className={cn('writer-editor mx-auto w-full max-w-[900px] px-4 pb-24 md:px-6', className)}
    >
      <header className='mb-8 border-border/60 border-b pb-4 pt-4 md:pt-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-muted-foreground text-xs font-medium uppercase tracking-[0.22em]'>
            Draft
          </p>
          <div className='flex items-center gap-2 rounded-full bg-muted/60 py-1 pr-1 pl-2.5 text-muted-foreground text-xs'>
            <span>{saveStatus}</span>
            <span aria-hidden='true'>·</span>
            <span>{wordsCount.toLocaleString()} words</span>
            <span aria-hidden='true' className='h-3 w-px bg-border/80' />
            <Button
              type='button'
              variant='ghost'
              size='icon-xs'
              className={cn(
                'rounded-full text-muted-foreground hover:text-foreground',
                publishedDateValue && 'text-foreground'
              )}
              onClick={() => setIsPublishingSettingsOpen(true)}
              aria-label='Open publishing settings'
            >
              <Settings2 />
            </Button>
          </div>
        </div>
      </header>

      <Dialog open={isPublishingSettingsOpen} onOpenChange={setIsPublishingSettingsOpen}>
        <DialogPopup className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Publishing settings</DialogTitle>
            <DialogDescription>
              Set the timestamp used by feeds and published post ordering.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className='space-y-3'>
            <label className='flex items-center gap-2 text-sm font-medium' htmlFor='published-date'>
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

      <div className='mb-6'>
        <input
          ref={fileInputRef}
          type='file'
          accept='image/*'
          className='hidden'
          onChange={handleFileChange}
        />
        {bannerImage ? (
          <div className='space-y-3'>
            <img
              src={bannerImage}
              alt='Article cover'
              className='h-52 w-full rounded-lg border border-border/70 object-cover'
            />
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={openFilePicker}
                disabled={disabled || isBannerUploading}
              >
                {isBannerUploading ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Upload className='h-4 w-4' />
                )}
                Change cover
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={onBannerImageRemove}
                disabled={disabled || isBannerUploading}
              >
                <Trash2 className='h-4 w-4' />
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <button
            type='button'
            onClick={openFilePicker}
            disabled={disabled || isBannerUploading}
            className='inline-flex items-center gap-2 text-lg text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60'
          >
            {isBannerUploading ? (
              <Loader2 className='h-5 w-5 animate-spin' />
            ) : (
              <ImagePlus className='h-5 w-5' />
            )}
            <span>Add a cover...</span>
          </button>
        )}
      </div>

      <input
        aria-label='Document title'
        className='mb-3 w-full border-0 bg-transparent p-0 text-4xl leading-[1.1] font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/70 focus:outline-none md:text-5xl'
        placeholder='Title'
        value={title}
        onChange={(event) => onTitleChange(event.currentTarget.value)}
      />
      <textarea
        aria-label='Document subtitle'
        className='mb-6 min-h-12 w-full resize-none border-0 bg-transparent p-0 text-lg leading-7 text-muted-foreground placeholder:text-muted-foreground/75 focus:outline-none'
        placeholder='Write a subtitle that pulls readers in'
        value={subtitle}
        onChange={(event) => onSubtitleChange(event.currentTarget.value)}
      />

      <EditorRoot>
        <div className='rounded-lg border border-border/70 bg-card px-5 py-6 shadow-xs/5 md:px-10 md:py-8'>
          <EditorContent
            initialContent={initialContent ?? ''}
            extensions={extensions as any}
            className='relative h-full w-full'
            immediatelyRender={false}
            editable={!disabled}
            editorProps={{
              handleDOMEvents: {
                keydown: (_view, event) => handleCommandNavigation(event),
              },
              attributes: {
                class: 'writer-prose focus:outline-none',
              },
            }}
            onCreate={({ editor }) => {
              const words = editor.storage.characterCount.words()
              setWordsCount(words)
              onContentChange?.({
                markdown: getAllContent(editor),
                words,
              })
            }}
            onUpdate={({ editor }) => {
              const words = editor.storage.characterCount.words()
              setWordsCount(words)
              onContentChange?.({
                markdown: getAllContent(editor),
                words,
              })
            }}
          >
            <EditorCommand className='z-50 h-auto max-h-[360px] overflow-y-auto rounded-xl border border-border/80 bg-popover p-1 shadow-xl transition-all'>
              <EditorCommandEmpty className='px-3 py-2 text-sm text-muted-foreground'>
                No commands found
              </EditorCommandEmpty>
              <EditorCommandList>
                {suggestionItems.map((item) => (
                  <EditorCommandItem
                    value={item.title}
                    onCommand={(val) => item?.command?.(val)}
                    className='flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent aria-selected:bg-accent'
                    key={item.title}
                  >
                    <div className='flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background'>
                      {item.icon}
                    </div>
                    <div>
                      <p className='font-medium'>{item.title}</p>
                      <p className='text-xs text-muted-foreground'>{item.description}</p>
                    </div>
                  </EditorCommandItem>
                ))}
              </EditorCommandList>
            </EditorCommand>
            <EditorBubble className='flex w-fit max-w-[90vw] overflow-hidden rounded-xl border border-border/80 bg-popover shadow-xl'>
              <NodeSelector open={openNode} onOpenChange={setOpenNode} />
              <Separator orientation='vertical' />
              <LinkSelector open={openLink} onOpenChange={setOpenLink} />
              <Separator orientation='vertical' />
              <ColorSelector open={openColor} onOpenChange={setOpenColor} />
            </EditorBubble>
          </EditorContent>
        </div>
      </EditorRoot>
    </section>
  )
}

export default AdvancedEditor
