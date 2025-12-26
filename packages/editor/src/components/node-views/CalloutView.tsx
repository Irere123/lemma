import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { clsx } from 'clsx'
import {
  IconInfoCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconBulb,
  IconNote,
} from '@tabler/icons-react'

import type { CalloutVariant } from '../../types'

const variantIcons: Record<CalloutVariant, React.ReactNode> = {
  info: <IconInfoCircle size={20} />,
  warning: <IconAlertTriangle size={20} />,
  success: <IconCircleCheck size={20} />,
  error: <IconCircleX size={20} />,
  tip: <IconBulb size={20} />,
  note: <IconNote size={20} />,
}

const variantColors: Record<CalloutVariant, string> = {
  info: 'callout-info',
  warning: 'callout-warning',
  success: 'callout-success',
  error: 'callout-error',
  tip: 'callout-tip',
  note: 'callout-note',
}

export function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const variant = (node.attrs.variant as CalloutVariant) || 'info'

  const cycleVariant = () => {
    const variants: CalloutVariant[] = ['info', 'tip', 'warning', 'success', 'error', 'note']
    const currentIndex = variants.indexOf(variant)
    const nextVariant = variants[(currentIndex + 1) % variants.length]
    updateAttributes({ variant: nextVariant })
  }

  return (
    <NodeViewWrapper
      className={clsx('callout-wrapper', variantColors[variant])}
      data-variant={variant}
    >
      <div className="callout-container">
        <button
          type="button"
          className="callout-icon-button"
          onClick={cycleVariant}
          contentEditable={false}
          title="Click to change callout type"
        >
          {variantIcons[variant]}
        </button>
        <div className="callout-content">
          <NodeViewContent className="callout-text" />
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export default CalloutView
