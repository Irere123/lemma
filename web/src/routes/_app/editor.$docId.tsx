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
import { DocumentSettingsModal } from "@/components/modals/document-settings-modal";
import { DocumentEditorSkeleton } from "@/components/skeletons";
import { EditorHeader } from "@/components/editor-header";
import { DocumentBanner } from "@/components/document-banner";

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
  const { mutateAsync: updateDbDocument, isPending: isUpsertLoading } =
    useMutation(trpc.documents.upsertDocument.mutationOptions());

  // Fetch the full document from the database
  const {
    data: dbDocument,
    isLoading: isDocumentLoading,
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
    return <DocumentEditorSkeleton />;
  }

  if (!document) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden relative">
      <EditorHeader
        document={document}
        isSynced={isSynced}
        isUpsertLoading={isUpsertLoading}
        onOpenNewsletter={() => setIsNewsletterDialogOpen(true)}
        onPublish={async () => {
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
        onUnpublish={async () => {
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
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
      <div className="mx-auto flex w-full flex-1 flex-col md:w-128 lg:w-160 xl:w-192">
        <DocumentBanner documentId={documentId} className="pt-2" />
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

      <DocumentSettingsModal
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        document={document}
        isSaving={isUpsertLoading}
        onSave={async (update) => {
          updateDocument(update as any);
          await updateDbDocument({
            ...(document as any),
            ...update,
            id: documentId,
          });
          await queryClient.invalidateQueries({
            queryKey: [
              ["documents", "getDocumentById"],
              { input: { id: documentId } },
            ],
          });
        }}
      />

      <SendNewsletterDialog
        documentId={documentId}
        documentTitle={document.title || "Untitled"}
        scheduledDate={document.scheduledDate}
        isOpen={isNewsletterDialogOpen}
        onClose={() => setIsNewsletterDialogOpen(false)}
        onScheduleUpdate={async (scheduledDate) => {
          updateDocument({ id: documentId, scheduledDate } as any);
          await updateDbDocument({
            ...(document as any),
            id: documentId,
            scheduledDate,
          });
          await queryClient.invalidateQueries({
            queryKey: [
              ["documents", "getDocumentById"],
              { input: { id: documentId } },
            ],
          });
        }}
      />
    </div>
  );
}
