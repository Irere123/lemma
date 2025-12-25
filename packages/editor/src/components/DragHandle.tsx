import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useFloating, offset, shift, autoUpdate } from '@floating-ui/react'
import { TextSelection } from 'prosemirror-state'
import { useEditorView } from '../context/EditorContext'
import { useEditorState } from '../hooks'
import { getDragHandleState, startDrag, updateDropPosition } from '../plugins/dragHandle'

export interface DragHandleProps {
  className?: string
}

export function DragHandle({ className }: DragHandleProps) {
  const view = useEditorView()
  const editorState = useEditorState()
  const [activeElement, setActiveElement] = useState<HTMLElement | null>(null)
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)

  const { refs, floatingStyles } = useFloating({
    open: !!activeElement,
    placement: 'left',
    middleware: [offset({ mainAxis: 4, crossAxis: 0 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })

  // Update position based on active block
  useEffect(() => {
    if (!view || !editorState) return

    const state = getDragHandleState(editorState)
    if (state?.activeBlockDom && !state.isDragging) {
      setActiveElement(state.activeBlockDom)
      refs.setReference(state.activeBlockDom)
    } else if (!state?.activeBlockPos) {
      setActiveElement(null)
    }
  }, [view, editorState, refs])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (!view) return

      dragStartPos.current = { x: e.clientX, y: e.clientY }
      isDragging.current = false

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragStartPos.current) return

        const deltaX = Math.abs(moveEvent.clientX - dragStartPos.current.x)
        const deltaY = Math.abs(moveEvent.clientY - dragStartPos.current.y)

        // Start dragging after a small threshold
        if (!isDragging.current && (deltaX > 5 || deltaY > 5)) {
          isDragging.current = true
          startDrag(view)
          document.body.classList.add('dragging-block')
        }

        if (isDragging.current) {
          updateDropPosition(view, moveEvent.clientY)
        }
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.classList.remove('dragging-block')
        dragStartPos.current = null

        if (isDragging.current) {
          // Trigger drop by dispatching a synthetic drop event
          const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
          })
          view.dom.dispatchEvent(dropEvent)
        }

        isDragging.current = false
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [view]
  )

  const handleAddClick = useCallback(() => {
    if (!view) return

    const state = getDragHandleState(view.state)
    if (state?.activeBlockPos !== null && state?.activeBlockNode) {
      // Insert a new paragraph after the current block
      const pos = state.activeBlockPos + state.activeBlockNode.nodeSize
      const { tr } = view.state
      const paragraph = view.state.schema.nodes.paragraph.create()
      tr.insert(pos, paragraph)
      tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))
      view.dispatch(tr)
      view.focus()
    }
  }, [view])

  if (!activeElement) {
    return null
  }

  return (
    <div ref={refs.setFloating} style={floatingStyles} className={`drag-handle ${className || ''}`}>
      <button type='button' className='drag-handle-add' onClick={handleAddClick} title='Add block'>
        <PlusIcon />
      </button>
      <button
        type='button'
        className='drag-handle-grip'
        onMouseDown={handleMouseDown}
        title='Drag to move'
      >
        <GripIcon />
      </button>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 14 14' fill='none' xmlns='http://www.w3.org/2000/svg'>
      <path
        d='M7 2V12M2 7H12'
        stroke='currentColor'
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

function GripIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 14 14' fill='none' xmlns='http://www.w3.org/2000/svg'>
      <circle cx='5' cy='3' r='1' fill='currentColor' />
      <circle cx='9' cy='3' r='1' fill='currentColor' />
      <circle cx='5' cy='7' r='1' fill='currentColor' />
      <circle cx='9' cy='7' r='1' fill='currentColor' />
      <circle cx='5' cy='11' r='1' fill='currentColor' />
      <circle cx='9' cy='11' r='1' fill='currentColor' />
    </svg>
  )
}

// Styles for drag handle component
export const dragHandleComponentStyles = `
.drag-handle {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background-color: white;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  z-index: 50;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: auto;
}

.ProseMirror:hover .drag-handle,
.drag-handle:hover {
  opacity: 1;
}

.drag-handle-add,
.drag-handle-grip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  color: #9ca3af;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.drag-handle-add:hover,
.drag-handle-grip:hover {
  color: #374151;
  background-color: #f3f4f6;
}

.drag-handle-grip {
  cursor: grab;
}

.drag-handle-grip:active {
  cursor: grabbing;
  background-color: #e5e7eb;
}

/* Styles during drag */
body.dragging-block {
  cursor: grabbing !important;
  user-select: none;
}

body.dragging-block * {
  cursor: grabbing !important;
}

body.dragging-block .ProseMirror {
  pointer-events: none;
}

body.dragging-block .drag-handle {
  pointer-events: auto;
}

/* Block menu popup (future enhancement) */
.block-menu-popup {
  position: absolute;
  z-index: 100;
  min-width: 200px;
  padding: 4px;
  background-color: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.block-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  font-size: 14px;
  color: #374151;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.block-menu-item:hover {
  background-color: #f5f5f5;
}

.block-menu-item.danger {
  color: #ef4444;
}

.block-menu-item.danger:hover {
  background-color: #fef2f2;
}

.block-menu-divider {
  height: 1px;
  margin: 4px 0;
  background-color: #e5e5e5;
}
`
