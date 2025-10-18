import type { BaseEditor, Descendant } from "slate";
import type { ReactEditor } from "slate-react";
import type { HistoryEditor } from "slate-history";

export type BrainOSEditor = BaseEditor & ReactEditor & HistoryEditor;

export enum ElementType {
  Paragraph = "paragraph",
  HeadingOne = "heading-one",
  HeadingTwo = "heading-two",
  HeadingThree = "heading-three",
  HeadingFour = "heading-four",
  ListItem = "list-item",
  BulletedList = "bulleted-list",
  NumberedList = "numbered-list",
  CheckListItem = "check-list-item",
  Blockquote = "block-quote",
  ExternalLink = "link",
  NoteLink = "note-link",
  Tag = "tag",
  CodeBlock = "code-block",
  ThematicBreak = "thematic-break",
  Image = "image",
  BlockReference = "block-reference",
  Callout = "callout",
  Toggle = "toggle",
  Divider = "divider",
}

export enum Mark {
  Bold = "bold",
  Italic = "italic",
  Code = "code",
  Underline = "underline",
  Strikethrough = "strikethrough",
  Highlight = "highlight",
}

export type ParagraphElement = {
  id: string;
  type: ElementType.Paragraph;
  children: Descendant[];
};

export type HeadingOneElement = {
  id: string;
  type: ElementType.HeadingOne;
  children: Descendant[];
};

export type HeadingTwoElement = {
  id: string;
  type: ElementType.HeadingTwo;
  children: Descendant[];
};

export type HeadingThreeElement = {
  id: string;
  type: ElementType.HeadingThree;
  children: Descendant[];
};

export type HeadingFourElement = {
  id: string;
  type: ElementType.HeadingFour;
  children: Descendant[];
};

export type ListItem = {
  id: string;
  type: ElementType.ListItem;
  children: Descendant[];
};

export type NumberedList = {
  id: string;
  type: ElementType.NumberedList;
  children: Descendant[];
};

export type CheckListItem = {
  id: string;
  type: ElementType.CheckListItem;
  checked: boolean;
  children: Descendant[];
};

export type Blockquote = {
  id: string;
  type: ElementType.Blockquote;
  children: Descendant[];
};

export type ExternalLink = {
  id: string;
  type: ElementType.ExternalLink;
  url: string;
  children: Descendant[];
};

export type NoteLink = {
  id: string;
  type: ElementType.NoteLink;
  noteId: string;
  noteTitle: string;
  customText?: string;
  children: Descendant[];
};

export type Tag = {
  id: string;
  type: ElementType.Tag;
  name: string; // name does not have #
  children: Descendant[]; // Children has the #
};

export type CodeBlock = {
  id: string;
  type: ElementType.CodeBlock;
  children: Descendant[];
};

export type ThematicBreak = {
  id: string;
  type: ElementType.ThematicBreak;
  children: Descendant[];
};

export type BulletedList = {
  id: string;
  type: ElementType.BulletedList;
  children: Descendant[];
};

export type Image = {
  id: string;
  type: ElementType.Image;
  url: string;
  caption?: string;
  children: Descendant[];
};

export type BlockReference = {
  id: string;
  type: ElementType.BlockReference;
  blockId: string;
  children: Descendant[];
};

export type Callout = {
  id: string;
  type: ElementType.Callout;
  variant?: "info" | "warning" | "success" | "error";
  children: Descendant[];
};

export type Toggle = {
  id: string;
  type: ElementType.Toggle;
  open?: boolean;
  children: Descendant[];
};

export type Divider = {
  id: string;
  type: ElementType.Divider;
  children: Descendant[];
};

export type ReferenceableBlockElement =
  | ParagraphElement
  | HeadingOneElement
  | HeadingTwoElement
  | HeadingThreeElement
  | HeadingFourElement
  | ListItem
  | CheckListItem
  | Blockquote
  | CodeBlock
  | ThematicBreak
  | Image
  | BlockReference
  | Callout
  | Toggle
  | Divider;

export type InlineElement = ExternalLink | NoteLink | Tag;
export type ListElement = BulletedList | NumberedList;
export type SpecialBlockElement = Callout | Toggle | Divider;

export type BrainOSElement =
  | ReferenceableBlockElement
  | ListElement
  | InlineElement;

export type FormattedText = { text: string } & Partial<Record<Mark, boolean>>;

export type BrainOSText = FormattedText;

declare module "slate" {
  interface CustomTypes {
    Editor: BrainOSEditor;
    Element: BrainOSElement;
    Text: BrainOSText;
  }
}
