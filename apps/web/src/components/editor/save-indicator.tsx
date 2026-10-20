import { CloudOff } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { DocumentSync, SyncSnapshot } from '@/lib/collab/document-sync'
import { useSyncState } from '@/lib/collab/hooks'

const LABEL: Record<SyncSnapshot['save'], string> = {
  saved: 'Saved',
  saving: 'Saving…',
  offline: 'Offline · saved on this device',
  unsaved: 'Not saved',
}

// A save normally confirms within milliseconds; only say "Saving…" when one
// is actually taking a while, instead of flickering on every keystroke.
const SAVING_LABEL_DELAY_MS = 700

/**
 * The save state changes on every keystroke, so this writes to the DOM
 * directly instead of re-rendering: any React commit while the editor has
 * focus makes React measure the selection across the whole contenteditable,
 * which is linear in document length.
 */
export function SaveIndicator({ sync }: { sync: DocumentSync }) {
  const labelRef = useRef<HTMLSpanElement>(null)
  // Rare transitions (offline, deleted) are fine to render normally.
  const offline = useSyncState(
    sync,
    (state) => state.save === 'offline' || state.save === 'unsaved'
  )
  const closed = useSyncState(sync, (state) => state.closed)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const render = () => {
      const label = labelRef.current
      if (!label) return
      const { save } = sync.getSnapshot()
      label.dataset.saveState = save
      if (timer) clearTimeout(timer)
      timer = null
      if (save === 'saving') {
        timer = setTimeout(() => {
          if (labelRef.current) labelRef.current.textContent = LABEL.saving
        }, SAVING_LABEL_DELAY_MS)
      } else {
        label.textContent = LABEL[save]
      }
    }
    render()
    const unsubscribe = sync.subscribe(render)
    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [sync])

  if (closed) return <span role='status'>This document was deleted</span>

  return (
    <>
      {offline ? <CloudOff className='size-3.5' aria-hidden='true' /> : null}
      {/* data-save-state is the precise state; the text is debounced for humans. */}
      <span ref={labelRef} role='status' aria-live='polite' data-save-state='saving' />
    </>
  )
}
