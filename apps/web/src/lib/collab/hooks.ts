import { FIELD_EDIT_ORIGIN, setText } from '@lemma/content/yjs'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type * as Y from 'yjs'

import { DocumentSync, type SyncSnapshot } from './document-sync'

const SERVER_SNAPSHOT: SyncSnapshot = {
  ready: false,
  save: 'saving',
  connected: false,
  closed: false,
  outdated: false,
}

/** One DocumentSync per mounted editor; torn down when the document changes. */
export function useDocumentSync(documentId: string): DocumentSync | null {
  const [sync, setSync] = useState<DocumentSync | null>(null)

  useEffect(() => {
    const next = new DocumentSync(documentId)
    setSync(next)
    // Leaving while edits haven't reached the server: ask first. (They're on
    // this device either way, but the writer may be about to switch devices.)
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      next.local.flush()
      if (next.hasUnconfirmedEdits) event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      next.destroy()
    }
  }, [documentId])

  return sync
}

/**
 * Subscribe to one slice of the sync state. Components re-render only when
 * their slice changes, so the save indicator ticking doesn't re-render the
 * editor on every keystroke.
 */
export function useSyncState<T>(sync: DocumentSync | null, select: (state: SyncSnapshot) => T): T {
  return useSyncExternalStore(
    sync?.subscribe ?? noopSubscribe,
    () => select(sync?.getSnapshot() ?? SERVER_SNAPSHOT),
    () => select(SERVER_SNAPSHOT)
  )
}

const noopSubscribe = () => () => {}

/**
 * A Y.Text as controlled-input state; local edits apply as minimal diffs,
 * tagged so the document's undo history includes them.
 */
export function useYText(text: Y.Text | null | undefined): [string, (value: string) => void] {
  const [value, setValue] = useState(() => text?.toString() ?? '')

  useEffect(() => {
    if (!text) return
    setValue(text.toString())
    const observer = () => setValue(text.toString())
    text.observe(observer)
    return () => text.unobserve(observer)
  }, [text])

  const update = useCallback(
    (next: string) => {
      if (!text) return
      setValue(next)
      text.doc?.transact(() => setText(text, next), FIELD_EDIT_ORIGIN)
    },
    [text]
  )

  return [value, update]
}
