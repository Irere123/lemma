import { ApiKeyForm } from "@/components/forms/api-key-form";
import { useApiKeysModalStore } from "@/stores/api-keys-modal";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { CopyInput } from "../copy-input";

export function CreateApiKeyModal() {
  const { setData, createdKey, type, setCreatedKey } = useApiKeysModalStore();

  let content = null;

  if (createdKey) {
    content = (
      <div className="p-4 space-y-4">
        <DialogHeader>
          <DialogTitle>API Key Created</DialogTitle>
          <DialogDescription>
            For security reasons, the key will only be shown once. Please copy
            and store it in a secure location.
          </DialogDescription>
        </DialogHeader>

        <CopyInput value={createdKey} />

        <DialogFooter>
          <Button onClick={() => setData(undefined)}>Done</Button>
        </DialogFooter>
      </div>
    );
  } else {
    content = (
      <div className="p-4 space-y-4">
        <DialogHeader>
          <DialogTitle>Create New API Key</DialogTitle>
          <DialogDescription>
            Create a new API key for your team.
          </DialogDescription>
        </DialogHeader>

        <ApiKeyForm
          onSuccess={(key) => {
            if (key) {
              setCreatedKey(key);
            }
          }}
        />
      </div>
    );
  }

  return (
    <Dialog
      open={type === "create"}
      onOpenChange={() => {
        setData(undefined);
        setTimeout(() => {
          setCreatedKey(undefined);
        }, 500);
      }}
    >
      <DialogContent>{content}</DialogContent>
    </Dialog>
  );
}
