// Helper function to validate image MIME type
export function isValidImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

// Helper function to get file extension from MIME type
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
  }
  return mimeToExt[mimeType] || '.jpg'
}
