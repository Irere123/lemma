import { Editor, Path } from "slate";
import { insertImage } from "../formatting";
import { isUrl } from "../url";
import type { ImageUploadFn } from "../../context";

// Default image extensions
const DEFAULT_IMAGE_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff", "tif",
  "avif", "heic", "heif"
];

// Store for context-provided functions
let imageUploadFn: ImageUploadFn | undefined;
let imageExtensions: string[] = DEFAULT_IMAGE_EXTENSIONS;
let showToastFn: ((message: string, type?: "success" | "error" | "info") => void) | undefined;

export function setImageUploadConfig(config: {
  uploadImage?: ImageUploadFn;
  extensions?: string[];
  showToast?: (message: string, type?: "success" | "error" | "info") => void;
}) {
  imageUploadFn = config.uploadImage;
  imageExtensions = config.extensions ?? DEFAULT_IMAGE_EXTENSIONS;
  showToastFn = config.showToast;
}

const withImages = (editor: Editor) => {
  const { insertData } = editor;

  editor.insertData = (data) => {
    const text = data.getData("text/plain");
    const { files } = data;

    // Handle file drops/pastes
    if (files && files.length > 0) {
      for (const file of files) {
        const [mime] = file.type.split("/");
        if (mime === "image") {
          uploadAndInsertImage(editor, file);
        } else {
          showToastFn?.("Only images can be uploaded.", "error");
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
  try {
    const ext = new URL(url).pathname.split(".").pop()?.toLowerCase();
    if (ext) {
      return imageExtensions.includes(ext);
    }
  } catch {
    return false;
  }
  return false;
};

export const uploadAndInsertImage = async (
  editor: Editor,
  file: File,
  path?: Path
) => {
  if (!imageUploadFn) {
    showToastFn?.("Image upload is not configured.", "error");
    return;
  }

  showToastFn?.("Uploading image...", "info");

  try {
    const result = await imageUploadFn(file);
    insertImage(editor, result.url, path);
    showToastFn?.("Image uploaded successfully", "success");
  } catch (err) {
    console.error("Image upload failed:", err);
    showToastFn?.("Failed to upload image", "error");
  }
};

export default withImages;
