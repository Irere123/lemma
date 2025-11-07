import * as React from "react";
import axios from "axios";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "./ui/button";
import { useDocumentStore } from "@/stores/document-store";
import { useTRPC } from "@/trpc/client";
import { getPreSignedUrl } from "@/lib/api/uploads";
import { getAssetUrl } from "@/lib/utils";

type Props = {
  documentId: string;
  className?: string;
};

export const DocumentBanner: React.FC<Props> = ({
  documentId,
  className = "",
}) => {
  const document = useDocumentStore((s) => s.documents[documentId]);
  const updateDocument = useDocumentStore((s) => s.updateDocument);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { mutateAsync: updateBanner, isPending } = useMutation(
    trpc.documents.updateBannerImage.mutationOptions()
  );

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  const handleOpenPicker = () => {
    inputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e
  ) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    const uploadingToast = toast.info("Uploading banner...");
    setIsUploading(true);
    try {
      const presign = await getPreSignedUrl({
        fileSize: file.size,
        contentType: file.type,
        filename: file.name,
      });

      await axios.put(presign.preSignedUrl, file, {
        headers: { "Content-Type": file.type },
      });

      const ogUrl = getAssetUrl(presign.filename);

      const updated = await updateBanner({
        documentId,
        bannerImage: ogUrl,
      } as any);

      updateDocument({
        id: documentId,
        bannerImage: updated?.bannerImage ?? ogUrl,
      });

      await queryClient.invalidateQueries({
        queryKey: [
          ["documents", "getDocumentById"],
          { input: { id: documentId } },
        ],
      });

      toast.success("Banner updated successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload banner");
    } finally {
      toast.dismiss(uploadingToast);
      setIsUploading(false);
      // Reset input value so same file selection re-triggers change
      if (e.currentTarget) e.currentTarget.value = "";
    }
  };

  const hasBanner = Boolean(document?.bannerImage);

  return (
    <div className={`w-full px-8 md:px-12 ${className}`}>
      <div className="w-full aspect-[16/6] md:aspect-[16/5] lg:aspect-[16/4] overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
        {hasBanner ? (
          <img
            src={document!.bannerImage as string}
            alt="Document banner"
            className="h-full w-full object-cover"
            onError={(ev) => {
              ev.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="text-sm text-gray-500">No banner image</div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button
          onClick={handleOpenPicker}
          aria-label={
            hasBanner ? "Replace banner image" : "Upload banner image"
          }
          disabled={isUploading || isPending}
        >
          {isUploading || isPending
            ? "Uploading..."
            : hasBanner
            ? "Replace banner"
            : "Upload banner"}
        </Button>
        {hasBanner ? (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await updateBanner({ documentId, bannerImage: "" } as any);
                updateDocument({ id: documentId, bannerImage: null });
                await queryClient.invalidateQueries({
                  queryKey: [
                    ["documents", "getDocumentById"],
                    { input: { id: documentId } },
                  ],
                });
              } catch (err) {
                console.error(err);
                toast.error("Failed to remove banner");
              }
            }}
            aria-label="Remove banner image"
            disabled={isUploading || isPending}
          >
            Remove
          </Button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Select banner image file"
          onChange={handleFileChange}
          tabIndex={-1}
        />
      </div>
    </div>
  );
};
