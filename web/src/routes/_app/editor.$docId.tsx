import { Editor, slateToMarkdown } from "@/editor";
import Title from "@/editor/Title";
import { getUntitledTitle } from "@/lib/utils";
import {
  documentStore,
  useDocumentStore,
  type DocumentUpdate,
} from "@/stores/document-store";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Descendant } from "slate";
import { SendNewsletterDialog } from "@/components/send-newsletter-dialog";
import { IconMail } from "@tabler/icons-react";

const SYNC_DEBOUNCE_MS = 1000;

export const Route = createFileRoute("/_app/editor/$docId")({
  loader: async ({ params, context }) => {
    const { docId } = params;

    // Only run on server
    if (typeof window === "undefined") {
      const { serverPrefetch } = await import("@/trpc/server");

      // Get the request from context for cookie forwarding
      const request = (context as any)?.request as Request | undefined;

      await serverPrefetch({
        request,
        queryKey: [
          ["documents", "getDocumentById"],
          { input: { id: docId }, type: "query" },
        ],
        fetchFn: (client) =>
          client.documents.getDocumentById.query({ id: docId }),
      });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { docId: documentId } = Route.useParams();
  const { mutateAsync: updateDbDocument } = useMutation(
    trpc.documents.upsertDocument.mutationOptions()
  );

  // Fetch the full document from the database
  const {
    data: dbDocument,
    isLoading: isDocumentLoading,
    isFetching: isDocumentFetching,
    error: documentError,
  } = useQuery(trpc.documents.getDocumentById.queryOptions({ id: documentId }));

  const updateDocument = useDocumentStore((state) => state.updateDocument);
  const upsertDocument = useDocumentStore((state) => state.upsertDocument);
  const document = useDocumentStore((state) => state.documents[documentId]);

  const [syncState, setSyncState] = useState({
    isTitleSynced: true,
    isContentSynced: true,
    isSubtitleSynced: true,
  });

  const [isNewsletterDialogOpen, setIsNewsletterDialogOpen] = useState(false);

  // Load document from database into store when fetched
  // This runs synchronously with the render cycle
  useEffect(() => {
    if (dbDocument) {
      // Use upsertDocument to ensure the document is properly loaded into the store
      upsertDocument(dbDocument);
    }
  }, [dbDocument, upsertDocument]);

  // Compute if we're ready to render the editor
  // We need both the database document AND the store to be synced
  const isReady = useMemo(() => {
    // If still loading or fetching initial data, not ready
    if (isDocumentLoading) return false;

    // If we have an error, we're "ready" to show the error
    if (documentError) return true;

    // If we have the database document but not in store yet, not ready
    if (dbDocument && !document) return false;

    // If we have both, we're ready
    if (dbDocument && document) return true;

    // Otherwise, not ready
    return false;
  }, [isDocumentLoading, dbDocument, document, documentError]);

  // Track whether document updates are synced to the database
  const isSynced = useMemo(
    () =>
      syncState.isTitleSynced &&
      syncState.isContentSynced &&
      syncState.isSubtitleSynced,
    [syncState]
  );

  const onTitleChange = useCallback(
    (title: string) => {
      // Only update Document title in storage if there isn't already a document with that title
      const newTitle = title || getUntitledTitle(documentId);

      updateDocument({ id: documentId, title: newTitle });
      setSyncState((syncState) => ({ ...syncState, isTitleSynced: false }));
    },
    [documentId, updateDocument]
  );

  const onSubtitleChange = useCallback(
    (subtitle: string) => {
      updateDocument({ id: documentId, subtitle: subtitle });
      setSyncState((syncState) => ({ ...syncState, isSubtitleSynced: false }));
    },
    [documentId, updateDocument]
  );

  const onEditorValueChange = useCallback(() => {
    setSyncState((syncState) => ({ ...syncState, isContentSynced: false }));
  }, []);

  const handleDocumentUpdate = useCallback(
    async (documentUpdate: DocumentUpdate) => {
      // Convert Slate content to markdown if content exists
      const updateData = { ...documentUpdate };
      if (documentUpdate.content) {
        updateData.markdown = slateToMarkdown(
          documentUpdate.content as Descendant[]
        );

        // If content is being updated and document is published, set status back to DRAFT
        if (document?.status === "PUBLISHED") {
          updateData.status = "DRAFT";
          // Update local store immediately
          updateDocument({ id: documentId, status: "DRAFT" });
        }
      }

      // Filter out null values to match schema expectations
      const filteredData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== null)
      );

      await updateDbDocument(filteredData);

      // Invalidate relevant queries after successful mutation
      await queryClient.invalidateQueries({
        queryKey: [
          ["documents", "getDocumentById"],
          { input: { id: documentId } },
        ],
      });

      setSyncState({
        isTitleSynced: true,
        isContentSynced: true,
        isSubtitleSynced: true,
      });
    },
    [
      updateDbDocument,
      document?.status,
      documentId,
      updateDocument,
      queryClient,
    ]
  );

  // Save the document in the database if it changes and it hasn't been saved yet
  useEffect(() => {
    const doc = documentStore.getState().documents[documentId];

    if (!doc) {
      return;
    }

    const documentUpdate: DocumentUpdate = { id: documentId };
    if (!syncState.isContentSynced) {
      documentUpdate.content = doc.content;
    }
    if (!syncState.isTitleSynced) {
      documentUpdate.title = doc.title;
    }
    if (!syncState.isSubtitleSynced) {
      documentUpdate.subtitle = doc.subtitle;
    }

    if (
      documentUpdate.title ||
      documentUpdate.content ||
      documentUpdate.subtitle
    ) {
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

  // Handle error state
  if (documentError) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <div className="mx-auto flex w-full flex-1 flex-col md:w-128 lg:w-160 xl:w-192">
          <div className="px-8 pt-8 pb-1 md:px-12 md:pt-12">
            <div className="text-3xl font-semibold leading-tight text-red-600 md:text-4xl">
              Error loading document
            </div>
            <div className="mt-4 text-gray-600">
              {documentError instanceof Error
                ? documentError.message
                : "An unknown error occurred"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <div className="mx-auto flex w-full flex-1 flex-col md:w-128 lg:w-160 xl:w-192">
          <div className="px-8 pt-8 pb-1 md:px-12 md:pt-12">
            <div className="text-3xl font-semibold leading-tight text-gray-400 md:text-4xl">
              Loading document...
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {isDocumentLoading
                ? "Fetching document from database..."
                : dbDocument && !document
                  ? "Syncing document to editor..."
                  : "Preparing editor..."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
      <div className="mx-auto flex w-full flex-1 flex-col md:w-128 lg:w-160 xl:w-192">
        {/* Top toolbar */}
        <div className="flex items-center justify-between px-8 pt-4 pb-2 md:px-12 border-b border-gray-200">
          <div className="flex items-center gap-4">
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

            {/* Sync Status Indicator */}
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  isSynced ? "bg-green-500" : "bg-yellow-500 animate-pulse"
                }`}
              />
              <span className="text-xs text-gray-500">
                {isSynced ? "All changes saved" : "Saving..."}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {document.status === "DRAFT" ? (
              <button
                onClick={async () => {
                  const updatePayload = {
                    ...(document as any),
                    id: documentId,
                    status: "PUBLISHED" as const,
                    publishedDate: document.publishedDate || new Date(),
                  };
                  await updateDbDocument(updatePayload);
                  updateDocument({
                    ...document,
                    id: documentId,
                    status: "PUBLISHED",
                    publishedDate: document.publishedDate || new Date(),
                  });
                  // Invalidate queries to ensure UI is in sync
                  await queryClient.invalidateQueries({
                    queryKey: [
                      ["documents", "getDocumentById"],
                      { input: { id: documentId } },
                    ],
                  });
                }}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Publish
              </button>
            ) : (
              <button
                onClick={async () => {
                  const updatePayload = {
                    ...(document as any),
                    id: documentId,
                    status: "DRAFT" as const,
                  };
                  await updateDbDocument(updatePayload);
                  updateDocument({
                    ...document,
                    id: documentId,
                    status: "DRAFT",
                  });
                  // Invalidate queries to ensure UI is in sync
                  await queryClient.invalidateQueries({
                    queryKey: [
                      ["documents", "getDocumentById"],
                      { input: { id: documentId } },
                    ],
                  });
                }}
                className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Unpublish
              </button>
            )}

            {document.status === "PUBLISHED" && (
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
                onBlur={async (e) => {
                  if (e.target.value !== document.bannerImage) {
                    await updateDbDocument({
                      ...(document as any),
                      id: documentId,
                      bannerImage: e.target.value,
                    });
                    // Invalidate queries after update
                    await queryClient.invalidateQueries({
                      queryKey: [
                        ["documents", "getDocumentById"],
                        { input: { id: documentId } },
                      ],
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
                  onChange={async (e) => {
                    const newDate = e.target.value
                      ? new Date(e.target.value)
                      : null;
                    updateDocument({
                      ...document,
                      id: documentId,
                      publishedDate: newDate,
                    });
                    await updateDbDocument({
                      ...(document as any),
                      id: documentId,
                      publishedDate: newDate,
                    });
                    // Invalidate queries after update
                    await queryClient.invalidateQueries({
                      queryKey: [
                        ["documents", "getDocumentById"],
                        { input: { id: documentId } },
                      ],
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
                  onChange={async (e) => {
                    const newDate = e.target.value
                      ? new Date(e.target.value)
                      : null;
                    updateDocument({
                      ...document,
                      id: documentId,
                      scheduledDate: newDate,
                    });
                    await updateDbDocument({
                      ...(document as any),
                      id: documentId,
                      scheduledDate: newDate,
                    });
                    // Invalidate queries after update
                    await queryClient.invalidateQueries({
                      queryKey: [
                        ["documents", "getDocumentById"],
                        { input: { id: documentId } },
                      ],
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
          onChangeSubtitle={onSubtitleChange}
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
