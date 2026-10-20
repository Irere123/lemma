import { createImageUpload } from '@lemma/headless'
import type { EditorView } from '@tiptap/pm/view'
import { toast } from 'sonner'

import { uploadFile } from '@/lib/api/uploads'

const MAX_BYTES = 10 * 1024 * 1024

/** Upload an image file to Lemma's storage and insert it at `pos`. */
export const uploadImage = createImageUpload({
  validateFn: (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Only images can be added here.')
      return false
    }
    if (file.size > MAX_BYTES) {
      toast.error('Images must be smaller than 10 MB.')
      return false
    }
    return true
  },
  onUpload: async (file) => {
    try {
      const uploaded = await uploadFile(file)
      return uploaded.url
    } catch (error) {
      toast.error(`Couldn't upload ${file.name}. Check your connection and try again.`)
      throw error
    }
  },
})

/** Open the system file picker and upload the chosen images at the caret. */
export function pickImages(view: EditorView) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  input.onchange = () => {
    const pos = view.state.selection.from
    for (const file of Array.from(input.files ?? []).reverse()) uploadImage(file, view, pos)
  }
  input.click()
}
