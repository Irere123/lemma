import { useSession } from "@/lib/auth-client";
import {
  documentStore,
  useDocumentStore,
  type Document,
} from "@/stores/document-store";
import { trpc } from "@/trpc/client";
import { useCallback, useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";

export default function PublishLayout() {
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const { data: session, isPending } = useSession();
  const { data: documents, isLoading: documentsLoading } =
    trpc.documents.getUserDocuments.useQuery();
  const navigate = useNavigate();

  const setupStore = useCallback(async () => {
    if (!isPageLoaded && !isPending && session?.user) {
      // Use user's specific store and rehydrate data
      documentStore.persist.clearStorage();
      documentStore.persist.setOptions({
        name: `documents-storage-${session.user.id}`,
      });
      await documentStore.persist.rehydrate();
    }
  }, [isPageLoaded, session, isPending]);

  useEffect(() => {
    setupStore();
  }, [setupStore]);

  const setDocuments = useDocumentStore((state) => state.setDocuments);

  const initData = useCallback(async () => {
    if (!session && !isPending) {
      return;
    }

    if (!documents && !documentsLoading) {
      setIsPageLoaded(true);
      return;
    }

    if (!documentsLoading) {
      // Set documents
      const docsAsObj = documents!.reduce<Record<Document["id"], Document>>(
        (acc, doc) => {
          acc[doc.id] = doc;
          return acc;
        },
        {}
      );
      setDocuments(docsAsObj);
    }
  }, [session, documents, documentsLoading, setDocuments, isPending]);

  useEffect(() => {
    if (!session?.user && !isPending) {
      // Redirect to login page if there is no user logged in
      navigate("/login");
    } else if (!isPageLoaded && session?.user) {
      // Initialize data if there is a user and the data has not been initialized yet
      initData();
    }
  }, [navigate, isPageLoaded, initData, isPending]);

  return (
    <div>
      <Outlet />
    </div>
  );
}
