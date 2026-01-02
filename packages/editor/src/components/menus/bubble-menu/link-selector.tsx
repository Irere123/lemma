import type { Editor } from '@tiptap/core'
import { CheckIcon, LinkIcon, TrashIcon } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
// constants
import { CORE_EXTENSIONS } from '@/constants/extension'
// helpers
import { isValidHttpUrl } from '@/helpers/common'
import { setLinkEditor, unsetLinkEditor } from '@/helpers/editor-commands'
import { cn } from '@/lib'
import { FloatingMenuRoot } from '../floating-menu/root'
import { useFloatingMenu } from '../floating-menu/use-floating-menu'

type Props = {
  editor: Editor
}

export function BubbleMenuLinkSelector(props: Props) {
  const { editor } = props
  // states
  const [error, setError] = useState(false)
  // floating ui
  const { options, getReferenceProps, getFloatingProps } = useFloatingMenu({})
  const { context } = options
  // refs
  const inputRef = useRef<HTMLInputElement>(null)

  const handleLinkSubmit = useCallback(() => {
    const input = inputRef.current
    if (!input) return
    const url = input.value
    if (!url) return
    const { isValid, url: validatedUrl } = isValidHttpUrl(url)
    if (isValid) {
      setLinkEditor(editor, validatedUrl)
      context.onOpenChange(false)
      setError(false)
    } else {
      setError(true)
    }
  }, [editor, inputRef, context])

  return (
    <FloatingMenuRoot
      classNames={{
        buttonContainer: 'h-full',
        button: cn(
          'h-full flex items-center gap-1 px-3 text-sm font-medium text-muted-foreground hover:bg-muted active:bg-muted rounded-sm whitespace-nowrap transition-colors',
          {
            'bg-muted': context.open,
            'text-foreground': editor.isActive(CORE_EXTENSIONS.CUSTOM_LINK),
          }
        ),
      }}
      getFloatingProps={getFloatingProps}
      getReferenceProps={getReferenceProps}
      menuButton={
        <>
          Link
          <LinkIcon className='shrink-0 size-3' />
        </>
      }
      options={options}
    >
      <div className='w-60 mt-1 rounded-md bg-card shadow-md'>
        <div
          className={cn('flex rounded-sm  border-[0.5px] border-border transition-colors', {
            'border-destructive': error,
          })}
        >
          <input
            ref={inputRef}
            type='url'
            placeholder='Enter or paste a link'
            onClick={(e) => e.stopPropagation()}
            className='flex-1 border-r-[0.5px] border-border bg-card py-2 px-1.5 text-xs outline-none placeholder:text-muted-foreground rounded-sm'
            defaultValue={editor.getAttributes('link').href || ''}
            onKeyDown={(e) => {
              setError(false)
              if (e.key === 'Enter') {
                e.preventDefault()
                handleLinkSubmit()
              }
            }}
            onFocus={() => setError(false)}
            autoFocus
          />
          {editor.getAttributes('link').href ? (
            <button
              type='button'
              className='grid place-items-center rounded-xs p-1 text-danger-primary hover:bg-danger-subtle-hover transition-all'
              onClick={(e) => {
                unsetLinkEditor(editor)
                e.stopPropagation()
                context.onOpenChange(false)
              }}
            >
              <TrashIcon className='size-4' />
            </button>
          ) : (
            <button
              type='button'
              className='h-full aspect-square grid place-items-center p-1 rounded-xs text-muted-foreground hover:bg-muted transition-all'
              onClick={(e) => {
                e.stopPropagation()
                handleLinkSubmit()
              }}
            >
              <CheckIcon className='size-4' />
            </button>
          )}
        </div>
        {error && (
          <p className='text-xs text-destructive my-1 px-2 pointer-events-none animate-in fade-in slide-in-from-top-0'>
            Please enter a valid URL
          </p>
        )}
      </div>
    </FloatingMenuRoot>
  )
}
