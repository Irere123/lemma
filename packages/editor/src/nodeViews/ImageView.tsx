import React, { useCallback, useRef, useState } from 'react'
import type { ReactNodeViewProps } from './ReactNodeView'

export function ImageView({ node, view, getPos, selected, updateAttributes }: ReactNodeViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const captionRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { src, alt, caption, width } = node.attrs

  const handleCaptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAttributes({ caption: e.target.value })
    },
    [updateAttributes]
  )

  const handleCaptionBlur = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleCaptionKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        setIsEditing(false)
        view.focus()
      }
      if (e.key === 'Escape') {
        setIsEditing(false)
        view.focus()
      }
    },
    [view]
  )

  const handleImageClick = useCallback(() => {
    if (!isEditing) {
      setIsEditing(true)
      setTimeout(() => {
        captionRef.current?.focus()
        captionRef.current?.select()
      }, 0)
    }
  }, [isEditing])

  const handleResize = useCallback(
    (newWidth: number) => {
      updateAttributes({ width: Math.max(100, Math.min(newWidth, 100)) })
    },
    [updateAttributes]
  )

  const handleDelete = useCallback(() => {
    const pos = getPos()
    if (pos === undefined) return

    const { tr } = view.state
    tr.delete(pos, pos + node.nodeSize)
    view.dispatch(tr)
  }, [view, getPos, node])

  return (
    <div
      ref={containerRef}
      className={`image-view ${selected ? 'selected' : ''}`}
      style={{ width: width ? `${width}%` : '100%' }}
      contentEditable={false}
    >
      <div className='image-container'>
        <img
          src={src}
          alt={alt || caption || ''}
          className='image-content'
          onClick={handleImageClick}
          draggable={false}
        />
        {selected && (
          <div className='image-toolbar'>
            <button
              type='button'
              className='image-toolbar-button'
              onClick={() => handleResize(50)}
              title='50% width'
            >
              50%
            </button>
            <button
              type='button'
              className='image-toolbar-button'
              onClick={() => handleResize(75)}
              title='75% width'
            >
              75%
            </button>
            <button
              type='button'
              className='image-toolbar-button'
              onClick={() => handleResize(100)}
              title='100% width'
            >
              100%
            </button>
            <div className='toolbar-divider' />
            <button
              type='button'
              className='image-toolbar-button danger'
              onClick={handleDelete}
              title='Delete image'
            >
              <TrashIcon />
            </button>
          </div>
        )}
        <ResizeHandle
          position='left'
          onResize={(delta) => {
            const currentWidth = containerRef.current?.offsetWidth || 0
            const parentWidth = containerRef.current?.parentElement?.offsetWidth || currentWidth
            const newWidthPercent = ((currentWidth - delta) / parentWidth) * 100
            handleResize(newWidthPercent)
          }}
        />
        <ResizeHandle
          position='right'
          onResize={(delta) => {
            const currentWidth = containerRef.current?.offsetWidth || 0
            const parentWidth = containerRef.current?.parentElement?.offsetWidth || currentWidth
            const newWidthPercent = ((currentWidth + delta) / parentWidth) * 100
            handleResize(newWidthPercent)
          }}
        />
      </div>
      <div className='image-caption'>
        {isEditing ? (
          <input
            ref={captionRef}
            type='text'
            className='caption-input'
            value={caption || ''}
            placeholder='Add a caption...'
            onChange={handleCaptionChange}
            onBlur={handleCaptionBlur}
            onKeyDown={handleCaptionKeyDown}
          />
        ) : (
          <span
            className={`caption-text ${!caption ? 'placeholder' : ''}`}
            onClick={handleImageClick}
          >
            {caption || 'Add a caption...'}
          </span>
        )}
      </div>
    </div>
  )
}

interface ResizeHandleProps {
  position: 'left' | 'right'
  onResize: (delta: number) => void
}

function ResizeHandle({ position, onResize }: ResizeHandleProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX
        onResize(position === 'left' ? -delta : delta)
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [position, onResize]
  )

  return <div className={`resize-handle ${position}`} onMouseDown={handleMouseDown} />
}

function TrashIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 14 14' fill='none' xmlns='http://www.w3.org/2000/svg'>
      <path
        d='M2.5 3.5H11.5M5.5 3.5V2.5C5.5 2.22386 5.72386 2 6 2H8C8.27614 2 8.5 2.22386 8.5 2.5V3.5M10.5 3.5V11.5C10.5 11.7761 10.2761 12 10 12H4C3.72386 12 3.5 11.7761 3.5 11.5V3.5'
        stroke='currentColor'
        strokeWidth='1.25'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

// Styles for image view
export const imageStyles = `
.image-view {
  position: relative;
  margin: 1rem auto;
  max-width: 100%;
  user-select: none;
}

.image-view.selected .image-container {
  outline: 2px solid #3b82f6;
  border-radius: 4px;
}

.image-view.loading,
.image-view.error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.image-loading,
.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #666;
}

.image-error {
  color: #ef4444;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.image-container {
  position: relative;
  display: inline-block;
  width: 100%;
}

.image-content {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 4px;
  cursor: pointer;
}

.image-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background-color: rgba(0, 0, 0, 0.75);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.image-toolbar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  font-size: 12px;
  color: #fff;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.image-toolbar-button:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.image-toolbar-button.danger:hover {
  background-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.toolbar-divider {
  width: 1px;
  height: 16px;
  background-color: rgba(255, 255, 255, 0.2);
  margin: 0 4px;
}

.resize-handle {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 60px;
  transform: translateY(-50%);
  background-color: rgba(59, 130, 246, 0.5);
  border-radius: 4px;
  cursor: ew-resize;
  opacity: 0;
  transition: opacity 0.15s;
}

.image-view:hover .resize-handle,
.image-view.selected .resize-handle {
  opacity: 1;
}

.resize-handle.left {
  left: -4px;
}

.resize-handle.right {
  right: -4px;
}

.image-caption {
  padding: 8px 0;
  text-align: center;
}

.caption-input {
  width: 100%;
  max-width: 400px;
  padding: 4px 8px;
  font-size: 14px;
  color: #666;
  text-align: center;
  background: transparent;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  outline: none;
}

.caption-input:focus {
  border-color: #3b82f6;
}

.caption-text {
  display: inline-block;
  font-size: 14px;
  color: #666;
  cursor: text;
}

.caption-text.placeholder {
  color: #999;
}
`
