import { useMutation } from "@tanstack/react-query";
import { IconChevronDown, IconCirclePlus } from "@tabler/icons-react";
import { Link, useNavigate } from "@tanstack/react-router";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useTRPC } from "@/trpc/client";
import { getDefaultEditorValue } from "@/editor/utils/constants";
import { documentStore } from "@/stores/document-store";

export function AppSidebar() {
  const trpc = useTRPC();
  const { isPending: upsertLoading, mutateAsync: upsertDocument } = useMutation(
    trpc.documents.upsertDocument.mutationOptions()
  );
  const navigate = useNavigate();

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <h2 className="text-xl font-bold">Brain</h2>
              <IconChevronDown className="ml-auto" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="justify-center px-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              disabled={upsertLoading}
              onClick={async () => {
                const resp = await upsertDocument({
                  content: getDefaultEditorValue(),
                });

                if (resp) {
                  // Add the document to the store immediately
                  documentStore.getState().upsertDocument(resp as any);

                  navigate({
                    to: "/editor/$docId",
                    params: { docId: resp.id },
                  });
                }
              }}
              className="group/new-document cursor-pointer"
            >
              New Doc
              <span>
                <IconCirclePlus
                  size={16}
                  className="group-hover/new-document:fill-black group-hover/new-document:text-white transition-all transform-gpu duration-200"
                />
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to={`/documents`}>Documents</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to={`/developers`}>Developers</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to={`/documents`}>Release Notes</Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
