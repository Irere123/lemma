import { useParams } from "react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Editor } from "@/editor";
import Title from "@/editor/Title";
import {
  documentStore,
  useDocumentStore,
  type DocumentUpdate,
} from "@/stores/document-store";
import { getUntitledTitle } from "@/lib/utils";
import type { Route } from "../+types/layout";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";

const SYNC_DEBOUNCE_MS = 1000;

export function meta({}: Route.MetaArgs) {
  return [{ title: "Editor" }];
}

export default function EditorPage() {
  const trpc = useTRPC();
  const { documentId } = useParams() as { documentId: string };
  const { mutateAsync: updateDbDocument } = useMutation(
    trpc.documents.upsertDocument.mutationOptions()
  );

  const updateDocument = useDocumentStore((state) => state.updateDocument);
  const document = useDocumentStore((state) => state.documents[documentId]);

  const [syncState, setSyncState] = useState({
    isTitleSynced: true,
    isContentSynced: true,
  });

  const isSynced = useMemo(
    () => syncState.isTitleSynced && syncState.isContentSynced,
    [syncState]
  );

  const onTitleChange = useCallback(
    (title: string) => {
      // Only update Document title in storage if there isn't already a document with that title
      const newTitle = title || getUntitledTitle(documentId);

      updateDocument({ id: documentId, title: newTitle, subtitle: "" });
      setSyncState((syncState) => ({ ...syncState, isTitleSynced: false }));
    },
    [documentId, updateDocument]
  );

  const onEditorValueChange = useCallback(() => {
    setSyncState((syncState) => ({ ...syncState, isContentSynced: false }));
  }, []);

  const handleDocumentUpdate = useCallback(
    async (document: DocumentUpdate) => {
      await updateDbDocument({ ...(document as any) });

      setSyncState({ isTitleSynced: true, isContentSynced: true });
    },
    [updateDbDocument]
  );

  // Save the document in the database if it changes and it hasn't been saved yet
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
  }, [syncState, handleDocumentUpdate, documentId]);

  // Prompt the user with a dialog box about unsaved changes if they navigate away
  useEffect(() => {
    const warningText =
      "You have unsaved changes — are you sure you wish to leave this page?";

    const handleWindowClose = (e: BeforeUnloadEvent) => {
      if (isSynced) return;
      e.preventDefault();
      return (e.returnValue = warningText);
    };

    window.addEventListener("beforeunload", handleWindowClose);

    return () => {
      window.removeEventListener("beforeunload", handleWindowClose);
    };
  }, [isSynced]);

  // Show loading state if document is not loaded yet
  if (!document) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <div className="mx-auto flex w-full flex-1 flex-col md:w-128 lg:w-160 xl:w-192">
          <div className="px-8 pt-8 pb-1 md:px-12 md:pt-12">
            <div className="text-3xl font-semibold leading-tight text-gray-400 md:text-4xl">
              Loading document...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
      <div className="mx-auto flex w-full flex-1 flex-col md:w-128 lg:w-160 xl:w-192">
        <div className="flex items-center justify-between px-8 pt-4 pb-2 md:px-12 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Type:</label>
              <select
                value={document.type || "ARTICLE"}
                onChange={(e) => {
                  updateDocument({
                    ...document,
                    id: documentId,
                    type: e.target.value as any,
                  });
                }}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ARTICLE">Article</option>
                <option value="NEWSLETTER">Newsletter</option>
                <option value="NOTE">Note</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Status:
              </label>
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  document.status === "PUBLISHED"
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {document.status || "DRAFT"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {document.status === "DRAFT" ? (
              <button
                onClick={() => {
                  updateDocument({
                    ...document,
                    id: documentId,
                    status: "PUBLISHED",
                  });
                }}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Publish
              </button>
            ) : (
              <button
                onClick={() => {
                  updateDocument({
                    ...document,
                    id: documentId,
                    status: "DRAFT",
                  });
                }}
                className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Unpublish
              </button>
            )}

            {document.status === "PUBLISHED" && document.type === "ARTICLE" && (
              <a
                href={`/posts/${documentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                View Live
              </a>
            )}
          </div>
        </div>

        <Title
          documentId={documentId}
          className="px-8 pt-4 pb-1 md:px-12 md:pt-8"
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
