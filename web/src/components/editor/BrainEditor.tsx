import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import axios from "axios";
import type { Descendant, Editor } from "slate";

import {
  EditorProvider,
  Editor as BaseEditor,
  ReadOnlyEditor as BaseReadOnlyEditor,
  Title as BaseTitle,
  createCustomEditor,
  setImageUploadConfig,
  type EditorProps,
  type TitleProps,
  type UIComponents,
  type ImageUploadFn,
  type EditorStoreApi,
  type DocumentStoreApi,
} from "@brain/editor";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import activeEditorsStore from "@/stores/active-editors-store";
import { documentStore } from "@/stores/document-store";
import { getPreSignedUrl } from "@/lib/api/uploads";

// UI Components adapter for Shadcn UI
const uiComponents: Partial<UIComponents> = {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
};

// Image upload function using the API
const uploadImage: ImageUploadFn = async (file) => {
  const { preSignedUrl, filename } = await getPreSignedUrl({
    fileSize: file.size,
    contentType: file.type,
    filename: file.name,
  });

  await axios.put(preSignedUrl, file, {
    headers: { "Content-Type": file.type },
  });

  return {
    url: `https://assets.irere.dev/${filename}`,
    filename,
  };
};

// Toast function adapter
const showToast = (message: string, type?: "success" | "error" | "info") => {
  switch (type) {
    case "success":
      toast.success(message);
      break;
    case "error":
      toast.error(message);
      break;
    case "info":
    default:
      toast.info(message);
      break;
  }
};

// Editor store adapter
const editorStoreAdapter: EditorStoreApi = {
  getActiveEditor: (documentId: string) =>
    activeEditorsStore.getActiveEditor(documentId),
  addActiveEditor: (documentId: string) =>
    activeEditorsStore.addActiveEditor(documentId),
  subscribe: (listener: () => void) => activeEditorsStore.subscribe(listener),
};

// Document store adapter
const documentStoreAdapter: DocumentStoreApi = {
  getDocument: (documentId: string) => {
    const state = documentStore.getState();
    const doc = state.documents[documentId];
    if (!doc) return undefined;
    return {
      id: doc.id,
      title: doc.title,
      subtitle: doc.subtitle,
      content: doc.content,
    };
  },
  updateDocument: (update) => {
    documentStore.getState().updateDocument(update);
  },
  subscribe: (listener: () => void) => documentStore.subscribe(listener),
};

// Configure image upload for the editor
setImageUploadConfig({
  uploadImage,
  showToast,
});

type BrainEditorProviderProps = {
  children: ReactNode;
};

export function BrainEditorProvider({ children }: BrainEditorProviderProps) {
  const createEditorFn = useMemo(() => createCustomEditor, []);

  return (
    <TooltipProvider delayDuration={300}>
      <EditorProvider
        ui={uiComponents}
        uploadImage={uploadImage}
        showToast={showToast}
        editorStore={editorStoreAdapter}
        documentStore={documentStoreAdapter}
        createEditor={createEditorFn}
      >
        {children}
      </EditorProvider>
    </TooltipProvider>
  );
}

// Re-export wrapped components
export function BrainEditor(props: EditorProps) {
  return (
    <BrainEditorProvider>
      <BaseEditor {...props} />
    </BrainEditorProvider>
  );
}

export function BrainReadOnlyEditor(props: { content: Descendant[]; className?: string }) {
  return (
    <BrainEditorProvider>
      <BaseReadOnlyEditor {...props} />
    </BrainEditorProvider>
  );
}

export function BrainTitle(props: TitleProps) {
  return (
    <BrainEditorProvider>
      <BaseTitle {...props} />
    </BrainEditorProvider>
  );
}

// Re-export types and utilities from the editor package
export type { EditorProps, TitleProps } from "@brain/editor";
export { slateToMarkdown, getDefaultEditorValue, ElementType, Mark } from "@brain/editor";
