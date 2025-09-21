import { IconPlus } from "@tabler/icons-react";

import type { Route } from "../+types/layout";
import { batchPrefetch, trpc } from "@/trpc/server";
import { CreateApiKeyModal } from "@/components/modals/create-api-key-modal";
import { DeleteApiKeyModal } from "@/components/modals/delete-api-key-modal";
import { EditApiKeyModal } from "@/components/modals/edit-api-key-modal";
import { useApiKeysModalStore } from "@/stores/api-keys-modal";
import { Button } from "@/components/ui/button";
import { DataTable as ApiKeysTable } from "@/components/tables/api-keys";

export async function loader() {
  batchPrefetch([trpc.apiKeys.get.queryOptions()]);
  return null;
}

export function meta({}: Route.MetaArgs) {
  return [{ title: "Developers / Brain" }];
}

export default function DevelopersPage() {
  const { setData } = useApiKeysModalStore();

  return (
    <main className="mx-auto w-full max-w-3xl">
      <div className="space-y-12">
        <div className="w-full">
          <div className="flex flex-col pb-4 gap-4">
            <div className="flex-1">
              <h3 className="text-xl font-semibold leading-none tracking-tight mb-2">
                Developers Portal
              </h3>

              <p className="text-sm text-[#606060]">
                These API keys allow other apps to access your data. Use it with
                caution – do not share your API key with others, or expose it in
                the browser or other client-side code.
              </p>
            </div>
            <div className="flex-shrink-0">
              <Button onClick={() => setData(undefined, "create")}>
                <IconPlus />
                Create API Key
              </Button>
            </div>
          </div>
          <ApiKeysTable />
        </div>
      </div>
      <EditApiKeyModal />
      <DeleteApiKeyModal />
      <CreateApiKeyModal />
    </main>
  );
}
