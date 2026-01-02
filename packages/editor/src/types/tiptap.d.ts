import "@tiptap/core";
import type { EditorState, Transaction } from "@tiptap/pm/state";

type CommandReturnType = boolean;
type DispatchFn = ((tr: Transaction) => void) | undefined;

// Extend TipTap types to include commands from extensions
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    // StarterKit commands
    bold: {
      toggleBold: () => ReturnType;
      setBold: () => ReturnType;
      unsetBold: () => ReturnType;
    };
    italic: {
      toggleItalic: () => ReturnType;
      setItalic: () => ReturnType;
      unsetItalic: () => ReturnType;
    };
    strike: {
      toggleStrike: () => ReturnType;
      setStrike: () => ReturnType;
      unsetStrike: () => ReturnType;
    };
    code: {
      toggleCode: () => ReturnType;
      setCode: () => ReturnType;
      unsetCode: () => ReturnType;
    };
    codeBlock: {
      toggleCodeBlock: (attributes?: { language?: string }) => ReturnType;
      setCodeBlock: (attributes?: { language?: string }) => ReturnType;
    };
    bulletList: {
      toggleBulletList: () => ReturnType;
    };
    orderedList: {
      toggleOrderedList: () => ReturnType;
    };
    blockquote: {
      toggleBlockquote: () => ReturnType;
      setBlockquote: () => ReturnType;
      unsetBlockquote: () => ReturnType;
    };
    horizontalRule: {
      setHorizontalRule: () => ReturnType;
    };
    // Underline extension
    underline: {
      toggleUnderline: () => ReturnType;
      setUnderline: () => ReturnType;
      unsetUnderline: () => ReturnType;
    };
    // Task list extension
    taskList: {
      toggleTaskList: () => ReturnType;
    };
    // Link extension
    link: {
      setLink: (attributes: { href: string; target?: string }) => ReturnType;
      toggleLink: (attributes: { href: string; target?: string }) => ReturnType;
      unsetLink: () => ReturnType;
    };
    // Text color extension
    customColor: {
      setTextColor: (color: string) => ReturnType;
      unsetTextColor: () => ReturnType;
      setBackgroundColor: (color: string) => ReturnType;
      unsetBackgroundColor: () => ReturnType;
    };
    // Callout extension
    callout: {
      insertCallout: () => ReturnType;
      setCalloutType: (type: string) => ReturnType;
    };
    // History commands
    history: {
      undo: () => ReturnType;
      redo: () => ReturnType;
    };
    // Utility commands
    utility: {
      addActiveDropbarExtension: (extensionName: string) => ReturnType;
      removeActiveDropbarExtension: (extensionName: string) => ReturnType;
      updateAssetsUploadStatus: (status: Record<string, unknown>) => ReturnType;
    };
    // Table extension commands - full set
    table: {
      insertTable: (options?: { rows?: number; cols?: number; withHeaderRow?: boolean }) => ReturnType;
      deleteTable: () => ReturnType;
      addColumnBefore: () => ReturnType;
      addColumnAfter: () => ReturnType;
      deleteColumn: () => ReturnType;
      addRowBefore: () => ReturnType;
      addRowAfter: () => ReturnType;
      deleteRow: () => ReturnType;
      mergeCells: () => ReturnType;
      splitCell: () => ReturnType;
      toggleHeaderColumn: () => ReturnType;
      toggleHeaderRow: () => ReturnType;
      toggleHeaderCell: () => ReturnType;
      clearSelectedCells: () => ReturnType;
      mergeOrSplit: () => ReturnType;
      setCellAttribute: (name: string, value: unknown) => ReturnType;
      goToNextCell: () => ReturnType;
      goToPreviousCell: () => ReturnType;
      fixTables: () => ReturnType;
      setCellSelection: (position: { anchorCell: number; headCell?: number }) => ReturnType;
    };
  }
}

// Extend Storage type
declare module "@tiptap/core" {
  interface Storage {
    utility?: {
      uploadInProgress?: boolean;
      activeDropbarExtensions?: string[];
      assetsList?: Array<{ id: string; src: string; href?: string; name?: string; type?: string }>;
    };
    emoji?: {
      forceOpen?: boolean;
      emojis?: string[];
    };
    imageComponent?: {
      fileMap?: Map<string, File>;
      deletedImageSet?: Set<string>;
      maxFileSize?: number;
    };
    link?: {
      isBubbleMenuOpen?: boolean;
      isPreviewOpen?: boolean;
    };
    characterCount?: {
      characters: () => number;
      words: () => number;
    };
    headingsList?: {
      headings: Array<{
        type: "heading";
        level: number;
        text: string;
        sequence: number;
      }>;
    };
  }
}
