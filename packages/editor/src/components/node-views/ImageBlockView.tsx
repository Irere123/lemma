import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconDownload,
  IconTrash,
} from '@tabler/icons-react'
import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react'
import { clsx } from 'clsx'
import { useCallback, useRef, useState } from 'react'

type Alignment = 'left' | 'center' | 'right'

export function ImageBlockView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const [isResizing, setIsResizing] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const startWidthRef = useRef(0)
  const startXRef = useRef(0)

  const { src, alt, title, width, alignment = 'center' } = node.attrs

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, direction: 'left' | 'right') => {
      e.preventDefault()
      setIsResizing(true)
      startXRef.current = e.clientX
      startWidthRef.current = imageRef.current?.offsetWidth || 0

      const handleMouseMove = (e: MouseEvent) => {
        const delta =
          direction === 'right' ? e.clientX - startXRef.current : startXRef.current - e.clientX

        const newWidth = Math.max(100, startWidthRef.current + delta * 2)
        updateAttributes({ width: Math.round(newWidth) })
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [updateAttributes]
  )

  const setAlignment = useCallback(
    (newAlignment: Alignment) => {
      updateAttributes({ alignment: newAlignment })
    },
    [updateAttributes]
  )

  const downloadImage = useCallback(async () => {
    try {
      const response = await fetch(src)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = alt || 'image'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download image:', error)
    }
  }, [src, alt])

  return (
    <NodeViewWrapper
      ref={containerRef}
      className={clsx(
        'image-block-wrapper',
        `image-block-${alignment}`,
        selected && 'image-block-selected',
        isResizing && 'image-block-resizing'
      )}
      data-alignment={alignment}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !isResizing && setShowControls(false)}
    >
      <div className='image-block-container' style={{ width: width ? `${width}px` : 'auto' }}>
        {/* Resize handles */}
        <div
          className={clsx('image-resize-handle image-resize-left', showControls && 'visible')}
          onMouseDown={(e) => handleMouseDown(e, 'left')}
          contentEditable={false}
        />
        <div
          className={clsx('image-resize-handle image-resize-right', showControls && 'visible')}
          onMouseDown={(e) => handleMouseDown(e, 'right')}
          contentEditable={false}
        />

        {/* Image */}
        <img
          ref={imageRef}
          src={src}
          alt={alt || ''}
          title={title || ''}
          className='image-block-img'
          draggable={false}
        />

        {/* Controls toolbar */}
        {showControls && (
          <div className='image-block-toolbar' contentEditable={false}>
            <button
              type='button'
              onClick={() => setAlignment('left')}
              className={clsx('image-toolbar-button', alignment === 'left' && 'active')}
              title='Align left'
            >
              <IconAlignLeft size={16} />
            </button>
            <button
              type='button'
              onClick={() => setAlignment('center')}
              className={clsx('image-toolbar-button', alignment === 'center' && 'active')}
              title='Align center'
            >
              <IconAlignCenter size={16} />
            </button>
            <button
              type='button'
              onClick={() => setAlignment('right')}
              className={clsx('image-toolbar-button', alignment === 'right' && 'active')}
              title='Align right'
            >
              <IconAlignRight size={16} />
            </button>
            <div className='image-toolbar-divider' />
            <button
              type='button'
              onClick={downloadImage}
              className='image-toolbar-button'
              title='Download image'
            >
              <IconDownload size={16} />
            </button>
            <button
              type='button'
              onClick={deleteNode}
              className='image-toolbar-button image-toolbar-delete'
              title='Delete image'
            >
              <IconTrash size={16} />
            </button>
          </div>
        )}

        {/* Caption */}
        {title && (
          <figcaption className='image-block-caption' contentEditable={false}>
            {title}
          </figcaption>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default ImageBlockView
