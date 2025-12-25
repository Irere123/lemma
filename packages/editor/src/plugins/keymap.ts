import { keymap } from "prosemirror-keymap";
import {
  toggleMark,
  baseKeymap,
  chainCommands,
  exitCode,
  joinUp,
  joinDown,
  lift,
  selectParentNode,
} from "prosemirror-commands";
import {
  splitListItem,
  liftListItem,
  sinkListItem,
} from "prosemirror-schema-list";
import type { Plugin } from "prosemirror-state";
import type { Schema } from "prosemirror-model";
import { schema } from "../schema";

/**
 * Creates formatting keymap (bold, italic, etc.)
 */
export function createFormattingKeymap(s: Schema = schema): Plugin {
  const bindings: Record<string, any> = {};

  // Bold: Mod-b
  if (s.marks.bold) {
    bindings["Mod-b"] = toggleMark(s.marks.bold);
  }

  // Italic: Mod-i
  if (s.marks.italic) {
    bindings["Mod-i"] = toggleMark(s.marks.italic);
  }

  // Underline: Mod-u
  if (s.marks.underline) {
    bindings["Mod-u"] = toggleMark(s.marks.underline);
  }

  // Code: Mod-`
  if (s.marks.code) {
    bindings["Mod-`"] = toggleMark(s.marks.code);
  }

  // Strikethrough: Mod-Shift-s
  if (s.marks.strikethrough) {
    bindings["Mod-Shift-s"] = toggleMark(s.marks.strikethrough);
  }

  // Highlight: Mod-Shift-h
  if (s.marks.highlight) {
    bindings["Mod-Shift-h"] = toggleMark(s.marks.highlight);
  }

  return keymap(bindings);
}

/**
 * Creates list-related keymap (Tab, Shift-Tab, Enter)
 */
export function createListKeymap(s: Schema = schema): Plugin {
  const bindings: Record<string, any> = {};

  // List item operations
  if (s.nodes.listItem) {
    bindings["Enter"] = splitListItem(s.nodes.listItem);
    bindings["Tab"] = sinkListItem(s.nodes.listItem);
    bindings["Shift-Tab"] = liftListItem(s.nodes.listItem);
  }

  // Task item operations
  if (s.nodes.taskItem) {
    bindings["Enter"] = chainCommands(
      splitListItem(s.nodes.taskItem),
      splitListItem(s.nodes.listItem)
    );
  }

  return keymap(bindings);
}

/**
 * Creates code block specific keymap
 */
export function createCodeBlockKeymap(s: Schema = schema): Plugin {
  const bindings: Record<string, any> = {};

  // Exit code block with triple Enter or Mod-Enter
  if (s.nodes.codeBlock) {
    bindings["Mod-Enter"] = exitCode;
    bindings["Shift-Enter"] = exitCode;
  }

  return keymap(bindings);
}

/**
 * Creates all editor keymaps
 */
export function createEditorKeymaps(s: Schema = schema): Plugin[] {
  return [
    createFormattingKeymap(s),
    createListKeymap(s),
    createCodeBlockKeymap(s),
    keymap({
      // Navigation
      "Alt-ArrowUp": joinUp,
      "Alt-ArrowDown": joinDown,
      "Mod-BracketLeft": lift,
      "Escape": selectParentNode,
    }),
    keymap(baseKeymap),
  ];
}
