import { type EditorState, Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'

const uploadKey = new PluginKey('upload-image')

export const UploadImagesPlugin = ({ imageClass }: { imageClass: string }) =>
  new Plugin({
    key: uploadKey,
    state: {
      init() {
        return DecorationSet.empty
      },
      apply(tr, set) {
        set = set.map(tr.mapping, tr.doc)
        // See if the transaction adds or removes any placeholders
        //@ts-expect-error - not yet sure what the type I need here
        const action = tr.getMeta(this)
        if (action?.add) {
          const { id, pos, src } = action.add

          const placeholder = document.createElement('div')
          placeholder.setAttribute('class', 'img-placeholder')
          const image = document.createElement('img')
          image.setAttribute('class', imageClass)
          image.src = src
          placeholder.appendChild(image)
          const deco = Decoration.widget(pos + 1, placeholder, {
            id,
          })
          set = set.add(tr.doc, [deco])
        } else if (action?.remove) {
          // biome-ignore lint/suspicious/noDoubleEquals: it's fine
          set = set.remove(set.find(undefined, undefined, (spec) => spec.id == action.remove.id))
        }
        return set
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)
      },
    },
  })

// biome-ignore lint/complexity/noBannedTypes: it's fine
function findPlaceholder(state: EditorState, id: {}) {
  const decos = uploadKey.getState(state) as DecorationSet
  // biome-ignore lint/suspicious/noDoubleEquals: it's fine
  const found = decos.find(undefined, undefined, (spec) => spec.id == id)
  return found.length ? found[0]?.from : null
}

export interface ImageUploadOptions {
  validateFn?: (file: File) => boolean
  onUpload: (file: File) => Promise<unknown>
}

export const createImageUpload =
  ({ validateFn, onUpload }: ImageUploadOptions): UploadFn =>
  (file, view, pos) => {
    if (validateFn && !validateFn(file)) return
    // A fresh object to act as the ID for this upload
    const id = {}

    // Show the local file as a placeholder while it uploads. Build the
    // transaction when the preview is ready, against the state at that time.
    let previewShown = false
    let finished = false
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      if (finished) return
      previewShown = true
      const tr = view.state.tr
      const at = Math.min(pos, tr.doc.content.size)
      view.dispatch(tr.setMeta(uploadKey, { add: { id, pos: at, src: reader.result } }))
    }

    onUpload(file).then(
      (src) => {
        finished = true
        const { schema } = view.state
        // Upload beat the local preview: insert where the file was dropped.
        const placeholderPos = previewShown
          ? findPlaceholder(view.state, id)
          : Math.min(pos, view.state.doc.content.size)
        // The content around the placeholder was deleted: drop the image.
        if (placeholderPos == null || typeof src !== 'string') {
          view.dispatch(view.state.tr.setMeta(uploadKey, { remove: { id } }))
          return
        }
        const node = schema.nodes.image?.create({ src, alt: file.name.replace(/\.[^.]+$/, '') })
        if (!node) return
        view.dispatch(
          view.state.tr
            .replaceWith(placeholderPos, placeholderPos, node)
            .setMeta(uploadKey, { remove: { id } })
        )
      },
      () => {
        finished = true
        // Deletes the image placeholder on error.
        if (findPlaceholder(view.state, id) == null) return
        view.dispatch(view.state.tr.setMeta(uploadKey, { remove: { id } }))
      }
    )
  }

export type UploadFn = (file: File, view: EditorView, pos: number) => void

const imageFiles = (files: FileList | undefined | null) =>
  Array.from(files ?? []).filter((file) => file.type.startsWith('image/'))

// A paste is "just images" when there's no HTML with real text beside them
// (Word and some browsers put a picture of the selection next to the HTML).
const isImageOnlyPaste = (data: DataTransfer) => {
  const html = data.getData('text/html')
  if (!html) return true
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '')
  return text.length === 0
}

export const handleImagePaste = (view: EditorView, event: ClipboardEvent, uploadFn: UploadFn) => {
  const data = event.clipboardData
  const files = imageFiles(data?.files)
  if (!data || files.length === 0 || !isImageOnlyPaste(data)) return false
  event.preventDefault()
  const pos = view.state.selection.from
  for (const file of files.reverse()) uploadFn(file, view, pos)
  return true
}

export const handleImageDrop = (
  view: EditorView,
  event: DragEvent,
  moved: boolean,
  uploadFn: UploadFn
) => {
  const files = imageFiles(event.dataTransfer?.files)
  if (moved || files.length === 0) return false
  event.preventDefault()
  const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })
  // Deduct one so the drop inserts at the expected block boundary.
  const dropPos = Math.max((coordinates?.pos ?? 0) - 1, 0)
  for (const file of files.reverse()) uploadFn(file, view, dropPos)
  return true
}
