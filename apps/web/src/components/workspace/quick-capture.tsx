import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { NotebookPen } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { create } from 'zustand'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { useCreate } from '@/hooks/use-create'
import { newClientId } from '@/lib/format'
import { hasMod, isMac } from '@/lib/keys'
import { enqueueCapture, flushCaptures, splitCapture } from '@/lib/notes/capture-queue'
import { useTRPC, useTRPCClient } from '@/trpc/client'

const DRAFT_KEY = 'lemma-capture-draft'

export const useQuickCapture = create<{ open: boolean; setOpen: (open: boolean) => void }>(
  (set) => ({
    open: false,
    setOpen: (open) => set({ open }),
  })
)

/**
 * Capture a note from anywhere (⌥⌘N / Ctrl+Alt+N): a blank page that's
 * ready for typing at once, needs no title, and is kept on the device until
 * it reaches the server, so it works offline. Also owns the workspace's
 * other note shortcut: today's note (⌥⌘D / Ctrl+Alt+D).
 */
export function QuickCapture() {
  const open = useQuickCapture((state) => state.open)
  const setOpen = useQuickCapture((state) => state.setOpen)
  const [text, setText] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  const client = useTRPCClient()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { openToday } = useCreate()

  const flush = useCallback(async () => {
    const sent = await flushCaptures(client)
    if (sent.length > 0) {
      void queryClient.invalidateQueries({ queryKey: trpc.documents.getUserDocuments.pathKey() })
    }
    return sent
  }, [client, queryClient, trpc])

  // Anything captured offline goes out as soon as it can.
  useEffect(() => {
    void flush()
    const onOnline = () => void flush()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [flush])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!hasMod(event) || !event.altKey || event.shiftKey) return
      if (event.code === 'KeyN') {
        event.preventDefault()
        setOpen(true)
      } else if (event.code === 'KeyD') {
        event.preventDefault()
        openToday()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openToday, setOpen])

  // An unsaved capture survives closing the panel or the tab.
  useEffect(() => {
    if (open) setText(localStorage.getItem(DRAFT_KEY) ?? '')
  }, [open])
  useEffect(() => {
    if (!open) return
    if (text) localStorage.setItem(DRAFT_KEY, text)
    else localStorage.removeItem(DRAFT_KEY)
  }, [open, text])

  const save = async (andOpen: boolean) => {
    const { title, body } = splitCapture(text)
    if (!title && !body) {
      setOpen(false)
      return
    }
    const id = newClientId()
    await enqueueCapture({ id, title, body, createdAt: Date.now() })
    localStorage.removeItem(DRAFT_KEY)
    setText('')
    setOpen(false)
    const sent = await flush()
    if (sent.includes(id)) {
      if (andOpen) void navigate({ to: '/write/$docId', params: { docId: id } })
      else
        toast.success('Note saved', {
          action: {
            label: 'Open',
            onClick: () => void navigate({ to: '/write/$docId', params: { docId: id } }),
          },
        })
    } else {
      toast('Saved on this device', {
        description: 'It goes to your notes as soon as you’re back online.',
      })
    }
  }

  const mod = isMac() ? '⌘' : 'Ctrl'
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPopup className='max-w-xl' initialFocus={field}>
        <DialogHeader className='pb-2'>
          <DialogTitle className='flex items-center gap-2 text-base'>
            <NotebookPen className='size-4 text-muted-foreground' />
            Quick note
          </DialogTitle>
          <DialogDescription>
            The first line becomes its title. Saved on this device first.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className='pt-1'>
          <textarea
            ref={field}
            value={text}
            aria-label='Note'
            placeholder='What’s on your mind?'
            onChange={(event) => setText(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && hasMod(event)) {
                event.preventDefault()
                void save(event.shiftKey)
              }
            }}
            className='min-h-40 w-full resize-none bg-transparent font-serif text-[17px] text-foreground leading-relaxed outline-none placeholder:text-muted-foreground/60 [field-sizing:content]'
          />
        </DialogPanel>
        <DialogFooter className='items-center'>
          <span className='mr-auto hidden items-center gap-1.5 text-[12px] text-muted-foreground sm:flex'>
            <KbdGroup>
              <Kbd>{mod}</Kbd>
              <Kbd>↵</Kbd>
            </KbdGroup>
            save
          </span>
          <Button variant='ghost' onClick={() => void save(true)}>
            Save and open
          </Button>
          <Button onClick={() => void save(false)}>Save note</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
