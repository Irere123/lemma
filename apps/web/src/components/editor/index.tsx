import {
  EditorBubble,
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  type EditorInstance,
  EditorRoot,
  getAllContent,
  handleCommandNavigation,
  type JSONContent,
} from '@lemma/headless'
import hljs from 'highlight.js'
import { useEffect, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'

import { Separator } from '../ui/separator'
import { defaultExtensions } from './extensions'
import { ColorSelector } from './selectors/color-selector'
import { LinkSelector } from './selectors/link-selector'
import { NodeSelector } from './selectors/node-selector'
import { slashCommand, suggestionItems } from './slash-command'

const extensions = [...defaultExtensions, slashCommand]

const AdvancedEditor = () => {
  const [initialContent, setInitialContent] = useState<null | JSONContent>(null)
  const [saveStatus, setSaveStatus] = useState('Saved')
  const [charsCount, setCharsCount] = useState<number | undefined>()

  const [openNode, setOpenNode] = useState(false)
  const [openColor, setOpenColor] = useState(false)
  const [openLink, setOpenLink] = useState(false)

  //Apply Codeblock Highlighting on the HTML from editor.getHTML()
  const highlightCodeblocks = (content: string) => {
    const doc = new DOMParser().parseFromString(content, 'text/html')
    doc.querySelectorAll('pre code').forEach((el) => {
      // https://highlightjs.readthedocs.io/en/latest/api.html?highlight=highlightElement#highlightelement
      // @ts-expect-error - hljs.highlightElement expects an HTMLElement, but el is an Element
      hljs.highlightElement(el)
    })
    return new XMLSerializer().serializeToString(doc)
  }

  const debouncedUpdates = useDebouncedCallback(async (editor: EditorInstance) => {
    const json = editor.getJSON()
    setCharsCount(editor.storage.characterCount.words())
    window.localStorage.setItem('html-content', highlightCodeblocks(editor.getHTML()))
    window.localStorage.setItem('novel-content', JSON.stringify(json))
    window.localStorage.setItem('markdown', getAllContent(editor))
    setSaveStatus('Saved')
  }, 500)

  useEffect(() => {
    const content = window.localStorage.getItem('novel-content')
    if (content) setInitialContent(JSON.parse(content))
    else setInitialContent([])
  }, [])

  if (!initialContent) return null

  return (
    <div className='relative w-full max-w-5xl h-full'>
      <div className='flex absolute right-5 top-5 z-10 mb-5 gap-2'>
        <div className='rounded-lg bg-accent px-2 py-1 text-sm text-muted-foreground'>
          {saveStatus}
        </div>
        <div
          className={
            charsCount ? 'rounded-lg bg-accent px-2 py-1 text-sm text-muted-foreground' : 'hidden'
          }
        >
          {charsCount} Words
        </div>
      </div>
      <EditorRoot>
        <EditorContent
          initialContent={initialContent}
          extensions={extensions as any}
          className='relative h-full w-full'
          editorProps={{
            handleDOMEvents: {
              keydown: (_view, event) => handleCommandNavigation(event),
            },
            attributes: {
              class:
                'prose prose-lg dark:prose-invert prose-headings:font-title font-default focus:outline-none max-w-full',
            },
          }}
          onUpdate={({ editor }) => {
            debouncedUpdates(editor)
            setSaveStatus('Unsaved')
          }}
        >
          <EditorCommand className='z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border border-muted bg-background px-1 py-2 shadow-md transition-all'>
            <EditorCommandEmpty className='px-2 text-muted-foreground'>
              No results
            </EditorCommandEmpty>
            <EditorCommandList>
              {suggestionItems.map((item) => (
                <EditorCommandItem
                  value={item.title}
                  onCommand={(val) => item?.command?.(val)}
                  className='flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent aria-selected:bg-accent'
                  key={item.title}
                >
                  <div className='flex h-10 w-10 items-center justify-center rounded-md border border-muted bg-background'>
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
          <EditorBubble className='flex w-fit max-w-[90vw] overflow-hidden rounded-md border border-muted bg-background shadow-xl'>
            <NodeSelector open={openNode} onOpenChange={setOpenNode} />
            <Separator orientation='vertical' />

            <LinkSelector open={openLink} onOpenChange={setOpenLink} />
            <Separator orientation='vertical' />
            <ColorSelector open={openColor} onOpenChange={setOpenColor} />
          </EditorBubble>
        </EditorContent>
      </EditorRoot>
    </div>
  )
}

export default AdvancedEditor
