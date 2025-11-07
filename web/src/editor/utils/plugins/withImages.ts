import { Editor, Path } from "slate";
import { toast } from "sonner";

import imageExtensions from "@/utils/image-extensions";
import { getPreSignedUrl } from "@/lib/api/uploads";
import { insertImage } from "../formatting";
import { isUrl } from "../url";
import axios from "axios";

const withImages = (editor: Editor) => {
  const { insertData } = editor;

  editor.insertData = (data) => {
    const text = data.getData("text/plain");
    const { files } = data;

    // TODO: there is a bug on iOS Safari where the files array is empty
    // See https://github.com/ianstormtaylor/slate/issues/4491
    if (files && files.length > 0) {
      for (const file of files) {
        const [mime] = file.type.split("/");
        if (mime === "image") {
          uploadAndInsertImage(editor, file);
        } else {
          toast.error("Only images can be uploaded.", {
            description: "Please upload an image file.",
          });
        }
      }
    } else if (isImageUrl(text)) {
      insertImage(editor, text);
    } else {
      insertData(data);
    }
  };

  return editor;
};

const isImageUrl = (url: string) => {
  if (!url || !isUrl(url)) {
    return false;
  }
  const ext = new URL(url).pathname.split(".").pop();
  if (ext) {
    return imageExtensions.includes(ext);
  }
  return false;
};
export const uploadAndInsertImage = async (
  editor: Editor,
  file: File,
  path?: Path
) => {
  const uploadingToast = toast.info("uploading image...");

  try {
    const { preSignedUrl, filename } = await getPreSignedUrl({
      fileSize: file.size,
      contentType: file.type,
      filename: file.name,
    });

    try {
      await axios.put(preSignedUrl, file, {
        headers: { "Content-Type": file.type },
      });
    } catch {
      toast.dismiss(uploadingToast);
      toast.error("upload failed");
      return;
    }

    const fileUrl = `https://assets.irere.dev/${filename}`;

    insertImage(editor, fileUrl, path);

    toast.dismiss(uploadingToast);
    toast.success("image uploaded successfully");
  } catch (err) {
    console.error(err);
    toast.dismiss(uploadingToast);
    toast.error("something went wrong while uploading");
  }
};

export default withImages;
