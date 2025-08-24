import createCustomEditor from "@/editor/utils/createEditor";
import { type Descendant, Editor } from "slate";

// Map from index of the editor to slate editor
let activeEditors: Record<string, Editor> = {};

let listeners: Array<() => void> = [];

export const activeEditorsStore = {
  getActiveEditor(documentId: string) {
    return activeEditors[documentId];
  },
  addActiveEditor(documentId: string) {
    if (activeEditors[documentId]) {
      return;
    }
    activeEditors = { ...activeEditors, [documentId]: createCustomEditor() };
    emitChange();
  },
  subscribe(listener: () => void) {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
  getSnapshot() {
    return activeEditors;
  },

  getServerSnapshot() {
    return true; // Always show "Online" for server-generated HTML
  },
};

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

// Get editor from active editors if it exists, or create a new one
export function getActiveOrTempEditor(noteId: string, content: Descendant[]) {
  let editor = activeEditorsStore.getActiveEditor(noteId);
  if (!editor) {
    editor = createCustomEditor();
    editor.children = content;
  }
  return editor;
}

export default activeEditorsStore;
