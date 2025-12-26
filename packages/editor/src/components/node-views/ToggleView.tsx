import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useCallback } from 'react'
import { clsx } from 'clsx'
import { IconChevronRight, IconChevronDown } from '@tabler/icons-react'

export function ToggleView({ node, updateAttributes }: NodeViewProps) {
  const isOpen = node.attrs.open !== false

  const toggleOpen = useCallback(() => {
    updateAttributes({ open: !isOpen })
  }, [updateAttributes, isOpen])

  return (
    <NodeViewWrapper className={clsx('toggle-wrapper', isOpen && 'toggle-open')}>
      <div className="toggle-header">
        <button
          type="button"
          onClick={toggleOpen}
          className="toggle-button"
          contentEditable={false}
          aria-expanded={isOpen}
          title={isOpen ? 'Collapse' : 'Expand'}
        >
          {isOpen ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
        </button>
        <div className="toggle-summary" data-placeholder="Toggle heading...">
          {/* The first child should be the summary/heading text */}
        </div>
      </div>
      {isOpen && (
        <div className="toggle-content">
          <NodeViewContent className="toggle-inner" />
        </div>
      )}
    </NodeViewWrapper>
  )
}

export default ToggleView
