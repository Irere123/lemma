import { useEditor } from '@lemma/headless'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import { Button } from '../ui/button'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { getUrlFromString } from './selectors/link-selector'

/**
 * Add or edit a link from the mobile toolbar. With nothing selected, the
 * address itself is inserted as the link text.
 */
export function LinkDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { editor } = useEditor()
  const [url, setUrl] = useState('')
  const [invalid, setInvalid] = useState(false)
  const range = useRef<{ from: number; to: number } | null>(null)

  useEffect(() => {
    if (!open || !editor) return
    if (editor.state.selection.empty && editor.isActive('link')) {
      editor.chain().extendMarkRange('link').run()
    }
    const { from, to } = editor.state.selection
    range.current = { from, to }
    setUrl(String(editor.getAttributes('link').href ?? ''))
    setInvalid(false)
  }, [editor, open])

  if (!editor) return null
  const editing = editor.isActive('link')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const href = getUrlFromString(url.trim())
    if (!href) {
      setInvalid(true)
      return
    }
    const chain = editor.chain().focus()
    if (range.current) chain.setTextSelection(range.current)
    if (range.current && range.current.from === range.current.to && !editing) {
      chain.insertContent({
        type: 'text',
        text: url.trim(),
        marks: [{ type: 'link', attrs: { href } }],
      })
    } else {
      chain.extendMarkRange('link').setLink({ href })
    }
    chain.run()
    onOpenChange(false)
  }

  const remove = () => {
    const chain = editor.chain().focus()
    if (range.current) chain.setTextSelection(range.current)
    chain.extendMarkRange('link').unsetLink().run()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className='max-w-sm'>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit link' : 'Add link'}</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <Input
              autoFocus
              type='url'
              inputMode='url'
              aria-label='Link address'
              aria-invalid={invalid}
              placeholder='https://'
              value={url}
              onChange={(event) => {
                setUrl(event.currentTarget.value)
                setInvalid(false)
              }}
            />
            {invalid ? (
              <p className='mt-2 text-destructive-foreground text-sm'>
                That doesn't look like a web address.
              </p>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            {editing ? (
              <Button type='button' variant='ghost' onClick={remove}>
                Remove link
              </Button>
            ) : null}
            <Button type='submit'>{editing ? 'Save' : 'Add link'}</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}
