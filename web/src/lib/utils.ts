import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { documentStore } from "@/stores/document-store";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function caseInsensitiveStringCompare(str1: string, str2: string) {
  return str1.localeCompare(str2, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function caseInsensitiveStringEqual(str1: string, str2: string) {
  return caseInsensitiveStringCompare(str1, str2) === 0;
}

// Get a unique "Untitled" title, ignoring the specified documentId.
export const getUntitledTitle = (documentId: string) => {
  const title = "Untitled";

  const getResult = () => (suffix > 0 ? `${title} ${suffix}` : title);

  let suffix = 0;
  const documentsArr = Object.values(documentStore.getState().documents);
  while (
    documentsArr.findIndex(
      (doc) =>
        doc.id !== documentId &&
        caseInsensitiveStringEqual(doc.title as string, getResult())
    ) > -1
  ) {
    suffix += 1;
  }

  return getResult();
};

// Returns a public asset URL from a storage key/filename
export const getAssetUrl = (key: string) => {
  if (!key) return "";
  const base = "https://assets.irere.dev";
  // Avoid duplicate slashes
  const normalizedBase = String(base).replace(/\/$/, "");
  const normalizedKey = String(key).replace(/^\//, "");
  return `${normalizedBase}/${normalizedKey}`;
};
