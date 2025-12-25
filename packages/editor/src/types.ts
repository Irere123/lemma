import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { EditorState, Transaction } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

// Node type names
export const NodeType = {
  Doc: "doc",
  Paragraph: "paragraph",
  Heading: "heading",
  BulletList: "bulletList",
  OrderedList: "orderedList",
  ListItem: "listItem",
  TaskList: "taskList",
  TaskItem: "taskItem",
  Blockquote: "blockquote",
  CodeBlock: "codeBlock",
  Callout: "callout",
  Toggle: "toggle",
  Image: "image",
  Divider: "divider",
  HardBreak: "hardBreak",
  Text: "text",
} as const;

export type NodeTypeName = (typeof NodeType)[keyof typeof NodeType];

// Mark type names
export const MarkType = {
  Bold: "bold",
  Italic: "italic",
  Code: "code",
  Underline: "underline",
  Strikethrough: "strikethrough",
  Highlight: "highlight",
  Link: "link",
  Tag: "tag",
  NoteLink: "noteLink",
} as const;

export type MarkTypeName = (typeof MarkType)[keyof typeof MarkType];

// Heading levels
export type HeadingLevel = 1 | 2 | 3 | 4;

// Callout variants
export type CalloutVariant = "info" | "warning" | "success" | "error";

// Node attributes
export interface HeadingAttrs {
  level: HeadingLevel;
  id?: string;
}

export interface TaskItemAttrs {
  checked: boolean;
  id?: string;
}

export interface CodeBlockAttrs {
  language: string | null;
  id?: string;
}

export interface CalloutAttrs {
  variant: CalloutVariant;
  id?: string;
}

export interface ToggleAttrs {
  open: boolean;
  id?: string;
}

export interface ImageAttrs {
  src: string;
  alt?: string;
  caption?: string;
  id?: string;
}

// Mark attributes
export interface LinkAttrs {
  href: string;
  title?: string;
}

export interface TagAttrs {
  name: string;
}

export interface NoteLinkAttrs {
  noteId: string;
  noteTitle: string;
  customText?: string;
}

// Editor types
export type EditorDispatch = (tr: Transaction) => void;

export interface EditorContextValue {
  view: EditorView | null;
  state: EditorState;
}

// Command type
export type Command = (
  state: EditorState,
  dispatch?: EditorDispatch,
  view?: EditorView
) => boolean;

// Image upload types
export interface ImageUploadResult {
  url: string;
  filename: string;
}

export type ImageUploadFn = (file: File) => Promise<ImageUploadResult>;

// Toast function type
export type ShowToastFn = (
  message: string,
  type?: "success" | "error" | "info"
) => void;

// Document types for store integration
export interface EditorDocument {
  id: string;
  title: string | null;
  subtitle: string | null;
  content?: ProseMirrorNode;
}

// Store API interfaces
export interface EditorStoreApi {
  getActiveEditor: (documentId: string) => EditorView | undefined;
  addActiveEditor: (documentId: string) => void;
  subscribe: (listener: () => void) => () => void;
}

export interface DocumentStoreApi {
  getDocument: (
    documentId: string
  ) => EditorDocument | undefined;
  updateDocument: (update: Partial<EditorDocument> & { id: string }) => void;
  subscribe: (listener: () => void) => () => void;
}

// UI Components interface for pluggable UI
export interface UIComponents {
  Tooltip: React.ComponentType<any>;
  TooltipTrigger: React.ComponentType<any>;
  TooltipContent: React.ComponentType<any>;
  TooltipProvider: React.ComponentType<any>;
  DropdownMenu: React.ComponentType<any>;
  DropdownMenuTrigger: React.ComponentType<any>;
  DropdownMenuContent: React.ComponentType<any>;
  DropdownMenuItem: React.ComponentType<any>;
  DropdownMenuSeparator: React.ComponentType<any>;
}

// Re-export ProseMirror types for convenience
export type { EditorState, Transaction } from "prosemirror-state";
export type { EditorView } from "prosemirror-view";
export type { Node as ProseMirrorNode, Schema, Mark } from "prosemirror-model";
