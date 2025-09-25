import { IconEdit, IconSettings } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { SidebarTrigger, useSidebar } from "./ui/sidebar";
import { useTRPC } from "@/trpc/client";
import { Button } from "./ui/button";
import { getDefaultEditorValue } from "@/editor/utils/constants";

export function AppHeader() {
  const { open } = useSidebar();
  const trpc = useTRPC();
  const navigate = useNavigate();
  const { isPending: upsertLoading, mutateAsync: upsertDocument } = useMutation(
    trpc.documents.upsertDocument.mutationOptions()
  );

  return (
    <div className="py-2 px-1 flex gap-3">
      <SidebarTrigger />
      {!open && (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="size-7">
            <IconSettings className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={upsertLoading}
            onClick={async () => {
              const resp = await upsertDocument({
                content: getDefaultEditorValue(),
              });

              if (resp) {
                navigate({ to: "/editor/$docId", params: { docId: resp.id } });
              }
            }}
          >
            <IconEdit className="size-5" />
          </Button>
        </div>
      )}
    </div>
  );
}
