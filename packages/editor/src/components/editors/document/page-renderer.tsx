import type { Editor } from '@tiptap/react'
// components
import { EditorContainer, EditorContentWrapper } from '@/components/editors'
import { BlockMenu, EditorBubbleMenu } from '@/components/menus'
import { cn } from '@/lib/utils'
// types
import type {
  ICollaborativeDocumentEditorPropsExtended,
  IEditorProps,
  IEditorPropsExtended,
  TDisplayConfig,
} from '@/types'

type Props = {
  bubbleMenuEnabled: boolean
  disabledExtensions: IEditorProps['disabledExtensions']
  displayConfig: TDisplayConfig
  documentLoaderClassName?: string
  editor: Editor
  titleEditor?: Editor
  editorContainerClassName: string
  extendedDocumentEditorProps?: ICollaborativeDocumentEditorPropsExtended
  extendedEditorProps: IEditorPropsExtended
  flaggedExtensions: IEditorProps['flaggedExtensions']
  id: string
  isLoading?: boolean
  isTouchDevice: boolean
  tabIndex?: number
}

export function PageRenderer(props: Props) {
  const {
    bubbleMenuEnabled,
    disabledExtensions,
    displayConfig,
    documentLoaderClassName,
    editor,
    editorContainerClassName,
    extendedEditorProps,
    flaggedExtensions,
    id,
    isLoading,
    isTouchDevice,
    tabIndex,
    titleEditor,
  } = props
  return (
    <div
      className={cn('frame-renderer w-full flex-grow', {
        'wide-layout': displayConfig.wideLayout,
      })}
    >
      {isLoading ? (
        <div className={documentLoaderClassName} />
      ) : (
        <>
          {titleEditor && (
            <div className='relative w-full py-3'>
              <EditorContainer
                editor={titleEditor}
                id={`${id}-title`}
                isTouchDevice={isTouchDevice}
                editorContainerClassName='page-title-editor bg-transparent py-3 border-none'
                displayConfig={displayConfig}
              >
                <EditorContentWrapper
                  editor={titleEditor}
                  id={`${id}-title`}
                  tabIndex={tabIndex}
                  className='no-scrollbar w-full resize-none rounded-none border-none bg-transparent p-0 font-bold text-[2rem] leading-[2.375rem] tracking-[-2%] placeholder-placeholder outline-none'
                />
              </EditorContainer>
            </div>
          )}
          <EditorContainer
            displayConfig={displayConfig}
            editor={editor}
            editorContainerClassName={editorContainerClassName}
            id={id}
            isTouchDevice={isTouchDevice}
          >
            <EditorContentWrapper editor={editor} id={id} tabIndex={tabIndex} />
            {editor.isEditable && !isTouchDevice && (
              <div>
                {bubbleMenuEnabled && (
                  <EditorBubbleMenu
                    editor={editor}
                    disabledExtensions={disabledExtensions}
                    extendedEditorProps={extendedEditorProps}
                    flaggedExtensions={flaggedExtensions}
                  />
                )}
                <BlockMenu
                  editor={editor}
                  flaggedExtensions={flaggedExtensions}
                  disabledExtensions={disabledExtensions}
                />
              </div>
            )}
          </EditorContainer>
        </>
      )}
    </div>
  )
}
