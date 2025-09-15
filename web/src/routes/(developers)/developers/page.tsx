import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import { batchPrefetch, trpc } from "@/trpc/server";
import { CreateApiKeyModal } from "@/components/modals/create-api-key-modal";
import { DeleteApiKeyModal } from "@/components/modals/delete-api-key-modal";
import { EditApiKeyModal } from "@/components/modals/edit-api-key-modal";
import { useApiKeysModalStore } from "@/stores/api-keys-modal";
import { Button } from "@/components/ui/button";
import type { Route } from "../+types/layout";

export async function loader() {
  batchPrefetch([trpc.apiKeys.get.queryOptions()]);
  return null;
}

export function meta({}: Route.MetaArgs) {
  return [{ title: "Developers Portal" }];
}

export default function DevelopersPage() {
  const trpc = useTRPC();
  const { setData } = useApiKeysModalStore();

  const { data, error, isLoading } = useQuery({
    ...trpc.apiKeys.get.queryOptions(),
  });

  if (isLoading || error) {
    return null;
  }

  return (
    <>
      <div className="space-y-12">
        <div className="w-full">
          <div className="flex flex-col md:flex-row md:items-center pb-4 gap-4 md:gap-8">
            <div className="flex-1">
              <h3 className="text-lg font-medium leading-none tracking-tight mb-2">
                API Keys
              </h3>

              <p className="text-sm text-[#606060]">
                These API keys allow other apps to access your team. Use it with
                caution – do not share your API key with others, or expose it in
                the browser or other client-side code.
              </p>
            </div>
            <div className="flex-shrink-0">
              <Button onClick={() => setData(undefined, "create")}>
                Create API Key
              </Button>
            </div>
          </div>
          {data?.length! > 0 ? (
            <div>
              {data?.map((key, idx) => (
                <div key={key.id}>
                  <p>
                    {idx + 1}.{key.name}
                  </p>
                  <p>{key.scopes}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <p>No Keys available</p>
            </div>
          )}
        </div>
      </div>
      <EditApiKeyModal />
      <DeleteApiKeyModal />
      <CreateApiKeyModal />
    </>
  );
}
