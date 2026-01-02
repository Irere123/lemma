import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { Content } from "@tiptap/core";

import type { IEditorProps } from "./editor";

type TCoreHookProps = Pick<
  IEditorProps,
  | "disabledExtensions"
  | "editorClassName"
  | "editorProps"
  | "extendedEditorProps"
  | "extensions"
  | "flaggedExtensions"
  | "getEditorMetaData"
  | "handleEditorReady"
  | "isTouchDevice"
  | "onEditorFocus"
>;

export type TEditorHookProps = TCoreHookProps &
  Pick<
    IEditorProps,
    | "autofocus"
    | "fileHandler"
    | "forwardedRef"
    | "id"
    | "onAssetChange"
    | "onChange"
    | "onTransaction"
    | "placeholder"
    | "showPlaceholderOnEmpty"
    | "tabIndex"
    | "value"
  > & {
    editable: boolean;
    enableHistory: boolean;
    initialValue?: Content;
    provider?: HocuspocusProvider;
  };

