// Main editor components
export { default as Editor, type EditorProps, type AddLinkPopoverState } from "./Editor";
export { default as ReadOnlyEditor } from "./ReadOnlyEditor";
export { default as Title, type TitleProps } from "./Title";

// Slash menu
export { SlashMenu, useSlashMenu, type SlashMenuState } from "./slashmenu";

// Context and providers
export {
  EditorProvider,
  useEditorContext,
  useUI,
  useImageUpload,
  useEditorStore,
  useDocumentStoreApi,
  useShowToast,
  useCallbacks,
  type EditorContextValue,
  type EditorProviderProps,
  type UIComponents,
  type ImageUploadFn,
  type ImageUploadResult,
  type EditorDocument,
  type EditorStoreApi,
  type DocumentStoreApi,
  type EditorCallbacks,
} from "./context";

// Serialization utilities
export { slateToMarkdown } from "./utils/serialization/slateToMarkdown";

// Types
export * from "./types";

// Editor creation utility
export { default as createCustomEditor } from "./utils/createEditor";
export { setImageUploadConfig } from "./utils/plugins/withImages";

// Formatting utilities
export {
  toggleMark,
  toggleElement,
  isMarkActive,
  isElementActive,
  handleEnter,
  handleIndent,
  handleUnindent,
  insertImage,
  unwrapLink,
  insertExternalLink,
  insertNoteLink,
} from "./utils/formatting";

// Constants
export { getDefaultEditorValue } from "./utils/constants";

// Code block utilities
export { parseHighlightLines } from "./elements/CodeBlockElement";
