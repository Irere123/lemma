import { type Descendant, Editor } from "slate";
import createCustomEditor from "../utils/createEditor";

// Map from index of the editor to slate editor
let activeEditors: Record<string, Editor> = {};

let listeners: Array<() => void> = [];

export const activeEditorsStore = {
  getActiveEditor(index: string) {
    return activeEditors[index];
  },
  addActiveEditor(noteId: string) {
    if (activeEditors[noteId]) {
      return;
    }
    activeEditors = { ...activeEditors, [noteId]: createCustomEditor() };
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
    return true; // Return a default or initial value for server-rendered content
  },
};

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

// Get editor from active editors if it exists, or create a new one
export function getActiveOrTempEditor(index: string, content: Descendant[]) {
  let editor = activeEditorsStore.getActiveEditor(index);
  if (!editor) {
    editor = createCustomEditor();
    editor.children = content;
  }
  return editor;
}

export default activeEditorsStore;
