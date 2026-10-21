import localforage from 'localforage'

/**
 * Quick-capture notes waiting to reach the server. A capture is written here
 * first, so it survives going offline, closing the tab or a crash, and is
 * sent (create, then fill) when the connection allows. The note's id is
 * chosen on the device, so retrying never makes a second note.
 */
export type Capture = { id: string; title: string; body: string; createdAt: number }

const store = localforage.createInstance({ name: 'lemma', storeName: 'captures' })

export async function enqueueCapture(capture: Capture) {
  await store.setItem(capture.id, capture)
}

export async function pendingCaptures(): Promise<Capture[]> {
  const captures: Capture[] = []
  await store.iterate<Capture, void>((value) => {
    captures.push(value)
  })
  return captures.sort((a, b) => a.createdAt - b.createdAt)
}

type Client = {
  documents: {
    createDocument: {
      mutate: (input: { id: string; kind: 'note'; title?: string }) => Promise<unknown>
    }
    upsertDocument: { mutate: (input: { id: string; markdown: string }) => Promise<unknown> }
  }
}

let flushing: Promise<string[]> | null = null

/** Send every pending capture; returns the ids that reached the server. */
export function flushCaptures(client: Client): Promise<string[]> {
  if (flushing) return flushing
  flushing = (async () => {
    const sent: string[] = []
    for (const capture of await pendingCaptures()) {
      try {
        await client.documents.createDocument.mutate({
          id: capture.id,
          kind: 'note',
          title: capture.title || undefined,
        })
        if (capture.body.trim()) {
          await client.documents.upsertDocument.mutate({ id: capture.id, markdown: capture.body })
        }
        await store.removeItem(capture.id)
        sent.push(capture.id)
      } catch {
        // Offline or the server is unreachable: keep it for the next try.
        break
      }
    }
    return sent
  })().finally(() => {
    flushing = null
  })
  return flushing
}

/** A capture's first line is its title (when short), the rest its body. */
export function splitCapture(text: string): { title: string; body: string } {
  const trimmed = text.replace(/^\s+/, '')
  const newline = trimmed.indexOf('\n')
  const first = (newline === -1 ? trimmed : trimmed.slice(0, newline)).trim()
  if (first.length > 0 && first.length <= 80) {
    return { title: first, body: newline === -1 ? '' : trimmed.slice(newline + 1).trim() }
  }
  return { title: '', body: trimmed.trim() }
}
