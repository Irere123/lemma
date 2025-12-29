import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { common, createLowlight } from 'lowlight'

import { CodeBlockView } from './CodeBlock'

// Create lowlight instance with common languages
const lowlight = createLowlight(common)

export interface EnhancedCodeBlockOptions {
  lowlight: ReturnType<typeof createLowlight>
  defaultLanguage: string | null | undefined
  HTMLAttributes: Record<string, unknown>
}

export const EnhancedCodeBlock = CodeBlockLowlight.extend<EnhancedCodeBlockOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      lowlight,
      defaultLanguage: 'plaintext',
      HTMLAttributes: {},
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
})

export { lowlight }
