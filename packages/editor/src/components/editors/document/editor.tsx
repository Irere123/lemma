import type { Extensions } from '@tiptap/core'
import type { MutableRefObject } from 'react'
import { forwardRef, useMemo } from 'react'
// components
import { PageRenderer } from '@/components/editors'
// constants
import { DEFAULT_DISPLAY_CONFIG } from '@/constants/config'
// extensions
import { DocumentEditorAdditionalExtensions } from '@/extensions'
// helpers
import { getEditorClassNames } from '@/helpers/common'
// hooks
import { useEditor } from '@/hooks/use-editor'
import { cn } from '@/lib/utils'
// types
import type { EditorRefApi, IDocumentEditorProps, TUserDetails } from '@/types'

function DocumentEditor(props: IDocumentEditorProps) {
  const {
    bubbleMenuEnabled = true,
    containerClassName,
    disabledExtensions,
    displayConfig = DEFAULT_DISPLAY_CONFIG,
    editable,
    editorClassName = '',
    extendedEditorProps,
    fileHandler,
    flaggedExtensions,
    forwardedRef,
    getEditorMetaData,
    handleEditorReady,
    id,
    isTouchDevice,
    onChange,
    user,
    value,
  } = props

  // Note: SideMenuExtension and HeadingListExtension are already included in CoreEditorExtensions
  // Only add document-specific extensions here (like SlashCommands)
  const extensions: Extensions = useMemo(() => {
    return DocumentEditorAdditionalExtensions({
      disabledExtensions,
      extendedEditorProps,
      flaggedExtensions,
      isEditable: editable,
      fileHandler,
      userDetails:
        user ??
        ({
          id: '',
          email: '',
          name: '',
        } as TUserDetails),
    })
  }, [disabledExtensions, editable, extendedEditorProps, fileHandler, flaggedExtensions, user])

  const editor = useEditor({
    disabledExtensions,
    editable,
    editorClassName,
    enableHistory: true,
    extendedEditorProps,
    extensions,
    fileHandler,
    flaggedExtensions,
    forwardedRef,
    getEditorMetaData,
    handleEditorReady,
    id,
    initialValue: value,
    onChange,
  })

  const editorContainerClassName = getEditorClassNames({
    containerClassName,
  })

  if (!editor) return null

  return (
    <PageRenderer
      bubbleMenuEnabled={bubbleMenuEnabled}
      displayConfig={displayConfig}
      editor={editor}
      editorContainerClassName={cn(editorContainerClassName, 'document-editor')}
      extendedEditorProps={extendedEditorProps}
      id={id}
      flaggedExtensions={flaggedExtensions}
      disabledExtensions={disabledExtensions}
      isTouchDevice={!!isTouchDevice}
    />
  )
}

const DocumentEditorWithRef = forwardRef(function DocumentEditorWithRef(
  props: IDocumentEditorProps,
  ref: React.ForwardedRef<EditorRefApi>
) {
  return <DocumentEditor {...props} forwardedRef={ref as MutableRefObject<EditorRefApi | null>} />
})

DocumentEditorWithRef.displayName = 'DocumentEditorWithRef'

export { DocumentEditorWithRef }
