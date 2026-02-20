import { useEditor } from '@lemma/headless'
import { Check, ChevronDown, Trash } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export function isValidUrl(url: string) {
  try {
    new URL(url)
    return true
  } catch (_e) {
    return false
  }
}
export function getUrlFromString(str: string) {
  if (isValidUrl(str)) return str
  try {
    if (str.includes('.') && !str.includes(' ')) {
      return new URL(`https://${str}`).toString()
    }
  } catch (_e) {
    return null
  }
}
interface LinkSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const LinkSelector = ({ open, onOpenChange }: LinkSelectorProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const selectionRef = useRef<{ from: number; to: number } | null>(null)
  const { editor } = useEditor()
  const [urlValue, setUrlValue] = useState('')

  // Autofocus on input by default
  useEffect(() => {
    if (open && editor) {
      const { from, to } = editor.state.selection
      selectionRef.current = { from, to }
      setUrlValue(editor.getAttributes('link').href || '')
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editor, open])
  if (!editor) return null

  return (
    <Popover modal={true} open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger>
        <Button
          size='sm'
          variant='ghost'
          className={cn('gap-1 rounded-none px-2', {
            'text-blue-500': editor.isActive('link'),
          })}
          onMouseDown={(event) => event.preventDefault()}
        >
          <span className='text-base'>↗</span>
          Link
          <ChevronDown className='h-4 w-4' />
        </Button>
      </PopoverTrigger>
      <PopoverPopup align='start' className='w-72 p-1' sideOffset={8}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const url = getUrlFromString(urlValue.trim())
            if (!url) return

            const chain = editor.chain().focus()
            if (selectionRef.current) {
              chain.setTextSelection(selectionRef.current)
            }
            chain.extendMarkRange('link').setLink({ href: url }).run()
            onOpenChange(false)
          }}
          className='flex items-center gap-1'
        >
          <input
            ref={inputRef}
            type='text'
            placeholder='Paste a link'
            className='h-8 flex-1 rounded-sm border bg-background px-2 text-sm outline-none'
            value={urlValue}
            onChange={(event) => setUrlValue(event.currentTarget.value)}
          />
          {editor.getAttributes('link').href ? (
            <Button
              size='icon'
              variant='outline'
              type='button'
              className='flex h-8 items-center rounded-sm p-1 text-red-600 transition-all hover:bg-red-100 dark:hover:bg-red-800'
              onClick={() => {
                const chain = editor.chain().focus()
                if (selectionRef.current) {
                  chain.setTextSelection(selectionRef.current)
                }
                chain.extendMarkRange('link').unsetLink().run()
                setUrlValue('')
                onOpenChange(false)
              }}
            >
              <Trash className='h-4 w-4' />
            </Button>
          ) : (
            <Button size='icon' className='h-8' type='submit'>
              <Check className='h-4 w-4' />
            </Button>
          )}
        </form>
      </PopoverPopup>
    </Popover>
  )
}
