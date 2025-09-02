import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useApiKeysModalStore } from "@/stores/api-keys-modal";
import { useTRPC } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { IconLoader } from "@tabler/icons-react";

export function DeleteApiKeyModal() {
  const { setData, type, data } = useApiKeysModalStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const deleteApiKeyMutation = useMutation(
    trpc.apiKeys.delete.mutationOptions({
      onSuccess: () => {
        setData(undefined);
        queryClient.invalidateQueries(trpc.apiKeys.get.queryOptions());
      },
    })
  );

  return (
    <Dialog open={type === "delete"} onOpenChange={() => setData(undefined)}>
      <DialogContent
        className="max-w-[455px]"
        onOpenAutoFocus={(evt) => evt.preventDefault()}
      >
        <div className="p-4 space-y-4">
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              This will permanently delete the API key{" "}
              <span className="text-primary">{data?.name}</span> for and revoke
              all access to your account. Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>

          <Button
            className="w-full mt-4"
            onClick={() => deleteApiKeyMutation.mutate({ id: data?.id! })}
          >
            {deleteApiKeyMutation.isPending ? (
              <IconLoader className="animate-spin" />
            ) : null}
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
