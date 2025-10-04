import { Editor, slateToMarkdown } from "@/editor";
import Title from "@/editor/Title";
import { getUntitledTitle } from "@/lib/utils";
import {
  documentStore,
  useDocumentStore,
  type DocumentUpdate,
} from "@/stores/document-store";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Descendant } from "slate";
import { SendNewsletterDialog } from "@/components/send-newsletter-dialog";
import { IconMail } from "@tabler/icons-react";

const SYNC_DEBOUNCE_MS = 1000;

export const Route = createFileRoute("/_app/editor/$docId")({
  component: RouteComponent,
});

function RouteComponent() {
  const trpc = useTRPC();
  const { docId: documentId } = Route.useParams();
  const { mutateAsync: updateDbDocument } = useMutation(
    trpc.documents.upsertDocument.mutationOptions()
  );

  const updateDocument = useDocumentStore((state) => state.updateDocument);
  const document = useDocumentStore((state) => state.documents[documentId]);

  const [syncState, setSyncState] = useState({
    isTitleSynced: true,
    isContentSynced: true,
  });

  const [isNewsletterDialogOpen, setIsNewsletterDialogOpen] = useState(false);

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
      // Convert Slate content to markdown if content exists
      const updateData = { ...(document as any) };
      if (document.content) {
        updateData.markdown = slateToMarkdown(document.content as Descendant[]);
      }

      await updateDbDocument(updateData);

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
        {/* Top toolbar */}
        <div className="flex items-center justify-between px-8 pt-4 pb-2 md:px-12 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Type:</label>
              <select
                value={document.type || "ARTICLE"}
                onChange={(e) => {
                  updateDbDocument({
                    ...(document as any),
                    id: documentId,
                    type: e.target.value as any,
                  });
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
                  const updatePayload = {
                    ...(document as any),
                    id: documentId,
                    status: "PUBLISHED",
                    publishedDate: document.publishedDate || new Date(),
                  };
                  updateDbDocument(updatePayload);
                  updateDocument({
                    ...document,
                    id: documentId,
                    status: "PUBLISHED",
                    publishedDate: document.publishedDate || new Date(),
                  });
                }}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Publish
              </button>
            ) : (
              <button
                onClick={() => {
                  updateDbDocument({
                    ...(document as any),
                    id: documentId,
                    status: "DRAFT",
                  });
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

        <div className="px-8 pt-4 pb-2 md:px-12 border-b border-gray-200">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Banner Image
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={document.bannerImage || ""}
                onChange={(e) => {
                  updateDocument({
                    ...document,
                    id: documentId,
                    bannerImage: e.target.value,
                  });
                }}
                onBlur={(e) => {
                  if (e.target.value !== document.bannerImage) {
                    updateDbDocument({
                      ...(document as any),
                      id: documentId,
                      bannerImage: e.target.value,
                    });
                  }
                }}
                placeholder="Enter banner image URL"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {document.bannerImage && (
              <div className="mt-2">
                <img
                  src={document.bannerImage}
                  alt="Banner preview"
                  className="w-full h-48 object-cover rounded-md"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-8 pt-4 pb-2 md:px-12 border-b border-gray-200">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              {/* Published Date Picker */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Published:
                </label>
                <input
                  type="datetime-local"
                  value={
                    document.publishedDate
                      ? new Date(document.publishedDate)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const newDate = e.target.value
                      ? new Date(e.target.value)
                      : null;
                    updateDocument({
                      ...document,
                      id: documentId,
                      publishedDate: newDate,
                    });
                    updateDbDocument({
                      ...(document as any),
                      id: documentId,
                      publishedDate: newDate,
                    });
                  }}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Scheduled Date Picker */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Schedule Email:
                </label>
                <input
                  type="datetime-local"
                  value={
                    document.scheduledDate
                      ? new Date(document.scheduledDate)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  onChange={(e) => {
                    const newDate = e.target.value
                      ? new Date(e.target.value)
                      : null;
                    updateDocument({
                      ...document,
                      id: documentId,
                      scheduledDate: newDate,
                    });
                    updateDbDocument({
                      ...(document as any),
                      id: documentId,
                      scheduledDate: newDate,
                    });
                  }}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Send Newsletter Button */}
            <button
              onClick={() => setIsNewsletterDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <IconMail className="w-4 h-4" />
              Send Newsletter
            </button>
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

      <SendNewsletterDialog
        documentId={documentId}
        documentTitle={document.title || "Untitled"}
        scheduledDate={document.scheduledDate}
        isOpen={isNewsletterDialogOpen}
        onClose={() => setIsNewsletterDialogOpen(false)}
      />
    </div>
  );
}
