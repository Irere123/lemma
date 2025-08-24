import { useParams } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Editor } from "@/editor";
import Title from "@/editor/Title";
import {
  documentStore,
  useDocumentStore,
  type DocumentUpdate,
} from "@/stores/document-store";
import { caseInsensitiveStringEqual, getUntitledTitle } from "@/lib/utils";
import type { Route } from "../+types/layout";

const SYNC_DEBOUNCE_MS = 1000;

export function meta({}: Route.MetaArgs) {
  return [{ title: "Editor" }];
}

export default function EditorPage() {
  const { documentId } = useParams() as { documentId: string };

  const updateDocument = useDocumentStore((state) => state.updateDocument);

  const onTitleChange = useCallback(
    (title: string) => {
      // Only update Document title in storage if there isn't already a document with that title
      const newTitle = title || getUntitledTitle(documentId);
      const docsArr = Object.values(documentStore.getState().documents);
      const isTitleUnique =
        docsArr.findIndex(
          (doc) =>
            doc.id !== documentId &&
            caseInsensitiveStringEqual(doc.title, newTitle)
        ) === -1;
      if (isTitleUnique) {
        updateDocument({ id: documentId, title: newTitle, subtitle: "" });
        setSyncState((syncState) => ({ ...syncState, isTitleSynced: false }));
      } else {
        console.error(
          `There's already a Document called ${newTitle}. Please use a different title.`
        );
      }
    },
    [documentId, updateDocument]
  );

  const [syncState, setSyncState] = useState({
    isTitleSynced: true,
    isContentSynced: true,
  });

  const isSynced = useMemo(
    () => syncState.isTitleSynced && syncState.isContentSynced,
    [syncState]
  );

  const onEditorValueChange = useCallback(() => {
    setSyncState((syncState) => ({ ...syncState, isContentSynced: false }));
  }, []);

  const handleDocumentUpdate = useCallback(async (document: DocumentUpdate) => {
    // const { error } = await updateDbDocument(Document);

    setSyncState({ isTitleSynced: true, isContentSynced: true });
  }, []);

  // Save the Document in the database if it changes and it hasn't been saved yet
  useEffect(() => {
    const doc = documentStore.getState().documents[documentId];

    if (!doc) {
      return;
    }

    const documentUpdate: DocumentUpdate = { id: documentId, subtitle: "" };
    if (!syncState.isContentSynced) {
      documentUpdate.content = doc.content;
    }
    if (!syncState.isTitleSynced) {
      documentUpdate.title = doc.title;
    }

    if (documentUpdate.title || documentUpdate.content) {
      const handler = setTimeout(
        () => handleDocumentUpdate(documentUpdate),
        SYNC_DEBOUNCE_MS
      );
      return () => clearTimeout(handler);
    }
  }, [documentStore, syncState, handleDocumentUpdate]);

  // Prompt the user with a dialog box about unsaved changes if they navigate away
  useEffect(() => {
    const warningText =
      "You have unsaved changes — are you sure you wish to leave this page?";

    const handleWindowClose = (e: BeforeUnloadEvent) => {
      if (isSynced) return;
      e.preventDefault();
      return (e.returnValue = warningText);
    };
    const handleBrowseAway = () => {
      if (isSynced) return;
      if (window.confirm(warningText)) return;
      throw "routeChange aborted";
    };

    window.addEventListener("beforeunload", handleWindowClose);

    return () => {
      window.removeEventListener("beforeunload", handleWindowClose);
    };
  }, [isSynced]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
      <div className="mx-auto flex w-full flex-1 flex-col md:w-128 lg:w-160 xl:w-192">
        <Title
          documentId={documentId}
          className="px-8 pt-8 pb-1 md:px-12 md:pt-12"
          onChange={onTitleChange}
        />
        <Editor
          documentId={documentId}
          className="px-8 pt-2 pb-8 md:px-12 md:pb-12"
          onChange={onEditorValueChange}
          highlightedPath={undefined}
        />
      </div>
    </div>
  );
}
