// Track which documents have active editors
// Used for managing document editing state

// Set of active document IDs
let activeDocumentIds: Set<string> = new Set()

let listeners: Array<() => void> = []

export const activeEditorsStore = {
  isActive(documentId: string): boolean {
    return activeDocumentIds.has(documentId)
  },
  addActiveEditor(documentId: string) {
    if (activeDocumentIds.has(documentId)) {
      return
    }
    activeDocumentIds = new Set(activeDocumentIds)
    activeDocumentIds.add(documentId)
    emitChange()
  },
  removeActiveEditor(documentId: string) {
    if (!activeDocumentIds.has(documentId)) {
      return
    }
    activeDocumentIds = new Set(activeDocumentIds)
    activeDocumentIds.delete(documentId)
    emitChange()
  },
  subscribe(listener: () => void) {
    listeners = [...listeners, listener]
    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  },
  getSnapshot() {
    return activeDocumentIds
  },
  getServerSnapshot() {
    return new Set<string>()
  },
}

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

export default activeEditorsStore
