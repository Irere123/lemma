import { ApiKeyForm } from "@/components/forms/api-key-form";
import { useApiKeysModalStore } from "@/stores/api-keys-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

export function EditApiKeyModal() {
  const { setData, type } = useApiKeysModalStore();

  return (
    <Dialog open={type === "edit"} onOpenChange={() => setData(undefined)}>
      <DialogContent
        className="max-w-[455px]"
        onOpenAutoFocus={(evt) => evt.preventDefault()}
      >
        <div className="p-4 space-y-4">
          <DialogHeader>
            <DialogTitle>Edit API Key</DialogTitle>
          </DialogHeader>

          <ApiKeyForm onSuccess={() => setData(undefined)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
