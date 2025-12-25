import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useFloating, offset, shift, autoUpdate, flip } from '@floating-ui/react'
import { useEditorView } from '../context/EditorContext'
import {
  getDragHandleState,
  startDrag,
  updateDropPosition,
  endDrag,
  insertBlockAfter,
  dragHandlePluginKey,
} from '../plugins/dragHandle'

export interface DragHandleProps {
  className?: string
}

export function DragHandle({ className }: DragHandleProps) {
  const view = useEditorView()
  const [activeElement, setActiveElement] = useState<HTMLElement | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)
  const handleRef = useRef<HTMLDivElement>(null)

  const { refs, floatingStyles } = useFloating({
    open: !!activeElement && isVisible,
    placement: 'left-start',
    middleware: [
      offset({ mainAxis: -8, crossAxis: 0 }),
      shift({ padding: 8 }),
      flip({ fallbackPlacements: ['left-end', 'right-start'] }),
    ],
    whileElementsMounted: autoUpdate,
  })

  // Subscribe to plugin state changes
  useEffect(() => {
    if (!view) return

    let animationFrame: number | null = null

    const updateFromState = () => {
      const state = dragHandlePluginKey.getState(view.state)

      if (state?.activeBlockDom && !state.isDragging) {
        setActiveElement(state.activeBlockDom)
        refs.setReference(state.activeBlockDom)
        setIsVisible(true)
      } else if (!state?.activeBlockPos && !state?.isDragging) {
        setIsVisible(false)
        // Delay clearing the element to allow for animation
        setTimeout(() => {
          const currentState = dragHandlePluginKey.getState(view.state)
          if (!currentState?.activeBlockPos && !currentState?.isDragging) {
            setActiveElement(null)
          }
        }, 150)
      }
    }

    // Initial check
    updateFromState()

    // Subscribe to state changes by patching dispatch
    const originalDispatch = view.dispatch.bind(view)
    const patchedDispatch = (tr: any) => {
      originalDispatch(tr)
      // Use requestAnimationFrame to batch updates
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
      animationFrame = requestAnimationFrame(updateFromState)
    }
    ;(view as any).dispatch = patchedDispatch

    return () => {
      ;(view as any).dispatch = originalDispatch
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [view, refs])

  // Keep handle visible when mouse is over it
  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return

    const handleMouseEnter = () => {
      setIsVisible(true)
    }

    const handleMouseLeave = () => {
      if (!isDragging.current && view) {
        const state = dragHandlePluginKey.getState(view.state)
        if (!state?.activeBlockPos) {
          setIsVisible(false)
        }
      }
    }

    handle.addEventListener('mouseenter', handleMouseEnter)
    handle.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      handle.removeEventListener('mouseenter', handleMouseEnter)
      handle.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [view])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!view) return

      dragStartPos.current = { x: e.clientX, y: e.clientY }
      isDragging.current = false

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragStartPos.current) return

        const deltaX = Math.abs(moveEvent.clientX - dragStartPos.current.x)
        const deltaY = Math.abs(moveEvent.clientY - dragStartPos.current.y)

        // Start dragging after a small threshold
        if (!isDragging.current && (deltaX > 3 || deltaY > 3)) {
          isDragging.current = true
          startDrag(view)
          document.body.classList.add('is-dragging-block')
        }

        if (isDragging.current) {
          updateDropPosition(view, moveEvent.clientY)
        }
      }

      const handleMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.classList.remove('is-dragging-block')

        if (isDragging.current) {
          // Trigger the drop by dispatching to the view
          const state = getDragHandleState(view.state)
          if (state?.dropPos !== null && state?.activeBlockPos !== null) {
            const from = state.activeBlockPos
            const to = state.dropPos
            const node = state.activeBlockNode

            if (node && from !== to) {
              const { tr } = view.state
              const nodeSize = node.nodeSize
              tr.delete(from, from + nodeSize)
              const adjustedTo = to > from ? to - nodeSize : to
              tr.insert(adjustedTo, node)
              view.dispatch(tr)
            }
          }
          endDrag(view)
        }

        dragStartPos.current = null
        isDragging.current = false
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [view]
  )

  const handleAddClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!view) return
      insertBlockAfter(view)
    },
    [view]
  )

  if (!view) {
    return null
  }

  return (
    <div
      ref={(node) => {
        handleRef.current = node
        refs.setFloating(node)
      }}
      style={{
        ...floatingStyles,
        opacity: isVisible && activeElement ? 1 : 0,
        pointerEvents: isVisible && activeElement ? 'auto' : 'none',
        transition: 'opacity 0.15s ease-in-out',
        zIndex: 50,
      }}
      className={`pm-drag-handle ${className || ''}`}
    >
      <button
        type='button'
        className='pm-drag-handle-add'
        onClick={handleAddClick}
        title='Click to add block below'
      >
        <PlusIcon />
      </button>
      <button
        type='button'
        className='pm-drag-handle-grip'
        onMouseDown={handleMouseDown}
        title='Drag to move block'
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
      <circle cx='5' cy='3' r='1.25' fill='currentColor' />
      <circle cx='9' cy='3' r='1.25' fill='currentColor' />
      <circle cx='5' cy='7' r='1.25' fill='currentColor' />
      <circle cx='9' cy='7' r='1.25' fill='currentColor' />
      <circle cx='5' cy='11' r='1.25' fill='currentColor' />
      <circle cx='9' cy='11' r='1.25' fill='currentColor' />
    </svg>
  )
}

// Styles for drag handle component
export const dragHandleComponentStyles = `
.pm-drag-handle {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

@media (prefers-color-scheme: dark) {
  .pm-drag-handle {
    background-color: #1f2937;
    border-color: #374151;
  }
}

.pm-drag-handle-add,
.pm-drag-handle-grip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: #9ca3af;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pm-drag-handle-add:hover,
.pm-drag-handle-grip:hover {
  color: #374151;
  background-color: #f3f4f6;
}

@media (prefers-color-scheme: dark) {
  .pm-drag-handle-add:hover,
  .pm-drag-handle-grip:hover {
    color: #e5e7eb;
    background-color: #374151;
  }
}

.pm-drag-handle-grip {
  cursor: grab;
}

.pm-drag-handle-grip:active {
  cursor: grabbing;
  background-color: #e5e7eb;
}

@media (prefers-color-scheme: dark) {
  .pm-drag-handle-grip:active {
    background-color: #4b5563;
  }
}
`
