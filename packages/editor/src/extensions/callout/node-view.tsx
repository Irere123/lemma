import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from '@tiptap/react'
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react'
// types
import type { TCalloutType } from './extension'

const CALLOUT_ICONS: Record<TCalloutType, React.ReactNode> = {
  info: <Info className='size-4' />,
  warning: <AlertTriangle className='size-4' />,
  error: <AlertCircle className='size-4' />,
  success: <CheckCircle className='size-4' />,
}

const CALLOUT_STYLES: Record<TCalloutType, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-green-200 bg-green-50 text-green-800',
}

export const CalloutNodeView = (props: NodeViewProps) => {
  const { node, selected } = props
  const type = (node.attrs.type as TCalloutType) || 'info'

  return (
    <NodeViewWrapper
      className={`editor-callout-component ${selected ? 'is-selected' : ''}`}
      data-type='calloutComponent'
    >
      <div className={`flex border gap-3 p-4 rounded-lg ${CALLOUT_STYLES[type]}`}>
        <div className='mt-0.5 flex-shrink-0'>{CALLOUT_ICONS[type]}</div>
        <div className='min-w-0 flex-1'>
          <NodeViewContent className='callout-content' />
        </div>
      </div>
    </NodeViewWrapper>
  )
}
