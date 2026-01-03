import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";
// types
import type { TImageStatus, TImageStorage } from "./types";

export const ImageNodeView = (props: NodeViewProps) => {
  const { node, editor, updateAttributes, selected } = props;
  const { src, id, width, height, status } = node.attrs as {
    src: string;
    id: string;
    width: string;
    height: string;
    status: TImageStatus;
  };

  const [isLoading, setIsLoading] = useState(status === "PENDING" || status === "UPLOADING");
  const [error, setError] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string>(src);

  const handleUpload = useCallback(async () => {
    if (!editor.isEditable) return;

    const storage = editor.storage.imageComponent as TImageStorage | undefined;
    const extensionOptions = editor.extensionManager.extensions.find(
      (ext) => ext.name === "imageComponent"
    )?.options as { fileHandler?: { upload: (id: string, file: File) => Promise<string> } } | undefined;

    if (!storage?.fileMap || !extensionOptions?.fileHandler) return;

    const file = storage.fileMap.get(id);
    if (!file) return;

    try {
      setIsLoading(true);
      updateAttributes({ status: "UPLOADING" });

      const uploadedSrc = await extensionOptions.fileHandler.upload(id, file);

      updateAttributes({
        src: uploadedSrc,
        status: "UPLOADED",
      });
      setImageSrc(uploadedSrc);

      // Clean up
      storage.fileMap.delete(id);
      URL.revokeObjectURL(src);
    } catch (err) {
      console.error("Image upload failed:", err);
      setError("Failed to upload image");
      updateAttributes({ status: "ERROR" });
    } finally {
      setIsLoading(false);
    }
  }, [editor, id, src, updateAttributes]);

  useEffect(() => {
    if (status === "PENDING" && editor.isEditable) {
      handleUpload();
    }
  }, [status, editor.isEditable, handleUpload]);

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setError("Failed to load image");
    setIsLoading(false);
  };

  return (
    <NodeViewWrapper
      className={`image-component ${selected ? "is-selected" : ""}`}
      data-type="imageComponent"
    >
      <div className="relative my-2">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center p-4 bg-red-50 text-red-600 rounded">
            {error}
          </div>
        )}

        {imageSrc && !error && (
          <img
            src={imageSrc}
            alt=""
            width={width}
            height={height}
            className={`max-w-full rounded transition-opacity ${isLoading ? "opacity-50" : "opacity-100"} ${selected ? "ring-2 ring-offset-2 ring-blue-500" : ""}`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            draggable={false}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
};
