import { history, undo, redo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import type { Plugin } from "prosemirror-state";

/**
 * Creates the history plugin with undo/redo keybindings
 */
export function createHistoryPlugins(): Plugin[] {
  return [
    history(),
    keymap({
      "Mod-z": undo,
      "Mod-y": redo,
      "Mod-Shift-z": redo,
    }),
  ];
}

export { undo, redo };
