import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useSession } from "@/lib/auth-client";
import {
  documentStore,
  useDocumentStore,
  type Document,
} from "@/stores/document-store";
import { useTRPC } from "@/trpc/client";

export const Route = createFileRoute("/_app")({
  component: RouteComponent,
});

function RouteComponent() {
  const trpc = useTRPC();
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const { data: session, isPending } = useSession();
  const { data: documents, isLoading: documentsLoading } = useQuery(
    trpc.documents.getUserDocuments.queryOptions({})
  );
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
      const docsAsObj = documents?.documents.reduce<
        Record<Document["id"], Omit<Document, "content" | "markdown">>
      >((acc, doc) => {
        acc[doc.id] = doc;
        return acc;
      }, {});
      setDocuments(docsAsObj ?? {});
    }
  }, [session, documents, documentsLoading, setDocuments, isPending]);

  useEffect(() => {
    if (!session?.user && !isPending) {
      // Redirect to login page if there is no user logged in
      navigate({ to: "/login" });
    } else if (!isPageLoaded && session?.user) {
      // Initialize data if there is a user and the data has not been initialized yet
      initData();
    }
  }, [navigate, isPageLoaded, initData, isPending]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="w-full">
        <AppHeader />
        <Outlet />
      </div>
    </SidebarProvider>
  );
}
