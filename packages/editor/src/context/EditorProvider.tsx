import { createContext, useContext, useMemo, type ReactNode, type ComponentType } from 'react'
import type { Descendant, Editor } from 'slate'

// Image upload types
export type ImageUploadResult = {
  url: string
  filename: string
}

export type ImageUploadFn = (file: File) => Promise<ImageUploadResult>

// Document types
export type EditorDocument = {
  id: string
  title: string | null
  subtitle: string | null
  content?: Descendant[]
}

// Editor store interface
export type EditorStoreApi = {
  getActiveEditor: (documentId: string) => Editor | undefined
  addActiveEditor: (documentId: string) => void
  subscribe: (listener: () => void) => () => void
}

// Document store interface
export type DocumentStoreApi = {
  getDocument: (documentId: string) => EditorDocument | undefined
  updateDocument: (update: {
    id: string
    content?: Descendant[]
    title?: string
    subtitle?: string
  }) => void
  subscribe: (listener: () => void) => () => void
}

// UI Component interfaces
export type TooltipProps = {
  children: ReactNode
}

export type DropdownMenuProps = {
  children: ReactNode
}

export type DropdownMenuTriggerProps = {
  children: ReactNode
  asChild?: boolean
}

export type DropdownMenuContentProps = {
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
}

export type DropdownMenuItemProps = {
  children: ReactNode
  onClick?: () => void
  className?: string
}

export type DropdownMenuSeparatorProps = {
  className?: string
}

export type UIComponents = {
  Tooltip: ComponentType<TooltipProps>
  TooltipTrigger: ComponentType<{ children: ReactNode; asChild?: boolean }>
  TooltipContent: ComponentType<{ children: ReactNode }>
  TooltipProvider: ComponentType<{ children: ReactNode; delayDuration?: number }>
  DropdownMenu: ComponentType<DropdownMenuProps>
  DropdownMenuTrigger: ComponentType<DropdownMenuTriggerProps>
  DropdownMenuContent: ComponentType<DropdownMenuContentProps>
  DropdownMenuItem: ComponentType<DropdownMenuItemProps>
  DropdownMenuSeparator: ComponentType<DropdownMenuSeparatorProps>
}

// Default fallback UI components (unstyled)
const DefaultTooltip: ComponentType<TooltipProps> = ({ children }) => (
  <div className='relative inline-block'>{children}</div>
)
const DefaultTooltipTrigger: ComponentType<{ children: ReactNode; asChild?: boolean }> = ({
  children,
}) => <>{children}</>
const DefaultTooltipContent: ComponentType<{ children: ReactNode }> = ({ children }) => (
  <span className='absolute bottom-full left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap'>
    {children}
  </span>
)
const DefaultTooltipProvider: ComponentType<{ children: ReactNode; delayDuration?: number }> = ({
  children,
}) => <>{children}</>

const DefaultDropdownMenu: ComponentType<DropdownMenuProps> = ({ children }) => (
  <div className='relative'>{children}</div>
)
const DefaultDropdownMenuTrigger: ComponentType<DropdownMenuTriggerProps> = ({ children }) => (
  <>{children}</>
)
const DefaultDropdownMenuContent: ComponentType<DropdownMenuContentProps> = ({
  children,
  className,
}) => (
  <div
    className={`absolute z-50 bg-white dark:bg-gray-800 border rounded shadow-lg ${className || ''}`}
  >
    {children}
  </div>
)
const DefaultDropdownMenuItem: ComponentType<DropdownMenuItemProps> = ({
  children,
  onClick,
  className,
}) => (
  <button
    onClick={onClick}
    className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${className || ''}`}
  >
    {children}
  </button>
)
const DefaultDropdownMenuSeparator: ComponentType<DropdownMenuSeparatorProps> = () => (
  <div className='h-px bg-gray-200 dark:bg-gray-700 my-1' />
)

const defaultUIComponents: UIComponents = {
  Tooltip: DefaultTooltip,
  TooltipTrigger: DefaultTooltipTrigger,
  TooltipContent: DefaultTooltipContent,
  TooltipProvider: DefaultTooltipProvider,
  DropdownMenu: DefaultDropdownMenu,
  DropdownMenuTrigger: DefaultDropdownMenuTrigger,
  DropdownMenuContent: DefaultDropdownMenuContent,
  DropdownMenuItem: DefaultDropdownMenuItem,
  DropdownMenuSeparator: DefaultDropdownMenuSeparator,
}

// Image extensions list
const DEFAULT_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'bmp',
  'ico',
  'tiff',
  'tif',
]

// Callbacks for editor events
export type EditorCallbacks = {
  onTagClick?: (tagName: string) => void
  onNoteLinkClick?: (noteId: string) => void
}

// Context value type
export type EditorContextValue = {
  ui: UIComponents
  uploadImage?: ImageUploadFn
  imageExtensions: string[]
  editorStore?: EditorStoreApi
  documentStore?: DocumentStoreApi
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void
  createEditor: () => Editor
  callbacks?: EditorCallbacks
}

const EditorContext = createContext<EditorContextValue | null>(null)

export type EditorProviderProps = {
  children: ReactNode
  ui?: Partial<UIComponents>
  uploadImage?: ImageUploadFn
  imageExtensions?: string[]
  editorStore?: EditorStoreApi
  documentStore?: DocumentStoreApi
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void
  createEditor: () => Editor
  callbacks?: EditorCallbacks
}

export function EditorProvider(props: EditorProviderProps) {
  const {
    children,
    ui,
    uploadImage,
    imageExtensions = DEFAULT_IMAGE_EXTENSIONS,
    editorStore,
    documentStore,
    showToast,
    createEditor,
    callbacks,
  } = props

  const value = useMemo<EditorContextValue>(
    () => ({
      ui: { ...defaultUIComponents, ...ui },
      uploadImage,
      imageExtensions,
      editorStore,
      documentStore,
      showToast,
      createEditor,
      callbacks,
    }),
    [
      ui,
      uploadImage,
      imageExtensions,
      editorStore,
      documentStore,
      showToast,
      createEditor,
      callbacks,
    ]
  )

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
}

export function useEditorContext() {
  const context = useContext(EditorContext)
  if (!context) {
    throw new Error('useEditorContext must be used within an EditorProvider')
  }
  return context
}

export function useUI() {
  return useEditorContext().ui
}

export function useImageUpload() {
  return useEditorContext().uploadImage
}

export function useEditorStore() {
  return useEditorContext().editorStore
}

export function useDocumentStoreApi() {
  return useEditorContext().documentStore
}

export function useShowToast() {
  return useEditorContext().showToast
}

export function useCallbacks() {
  return useEditorContext().callbacks
}
