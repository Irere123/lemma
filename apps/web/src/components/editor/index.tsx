import {
  EditorBubble,
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  type EditorInstance,
  EditorRoot,
  handleCommandNavigation,
  type JSONContent,
  getAllContent,
} from '@lemma/headless'
import { useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'

import { cn } from '@/lib/utils'
import { Separator } from '../ui/separator'
import { defaultExtensions } from './extensions'
import { ColorSelector } from './selectors/color-selector'
import { LinkSelector } from './selectors/link-selector'
import { NodeSelector } from './selectors/node-selector'
import { slashCommand, suggestionItems } from './slash-command'

const extensions = [...defaultExtensions, slashCommand]

export type WriterEditorUpdate = {
  html: string
  json: JSONContent
  markdown: string
  words: number
}

type AdvancedEditorProps = {
  initialContent?: JSONContent
  title: string
  subtitle: string
  saveStatus?: string
  disabled?: boolean
  className?: string
  onTitleChange: (value: string) => void
  onSubtitleChange: (value: string) => void
  onContentChange?: (value: WriterEditorUpdate) => void
}

const AdvancedEditor = ({
  className,
  disabled = false,
  initialContent,
  onContentChange,
  onSubtitleChange,
  onTitleChange,
  saveStatus = 'Saved',
  subtitle,
  title,
}: AdvancedEditorProps) => {
  const [wordsCount, setWordsCount] = useState<number>(0)
  const [openNode, setOpenNode] = useState(false)
  const [openColor, setOpenColor] = useState(false)
  const [openLink, setOpenLink] = useState(false)

  const debouncedUpdates = useDebouncedCallback(async (editor: EditorInstance) => {
    onContentChange?.({
      json: editor.getJSON(),
      html: editor.getHTML(),
      markdown: getAllContent(editor),
      words: editor.storage.characterCount.words(),
    })
  }, 500)

  return (
    <section className={cn('writer-editor mx-auto w-full max-w-[860px] px-4 pb-24', className)}>
      <header className='mb-8 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4 pt-6'>
        <p className='text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground'>
          Draft
        </p>
        <div className='flex items-center gap-3 text-xs text-muted-foreground'>
          <span>{saveStatus}</span>
          <span aria-hidden='true'>·</span>
          <span>{wordsCount.toLocaleString()} words</span>
        </div>
      </header>

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
        <div className='rounded-2xl border border-border/70 bg-card/50 px-5 py-6 md:px-10 md:py-8'>
          <EditorContent
            initialContent={initialContent ?? []}
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
              setWordsCount(editor.storage.characterCount.words())
            }}
            onUpdate={({ editor }) => {
              setWordsCount(editor.storage.characterCount.words())
              debouncedUpdates(editor)
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
