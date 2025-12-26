// Type exports (safe for SSR - no ProseMirror dependencies)
export type {
  BrainEditorProps,
  BrainReadOnlyEditorProps,
  BrainTitleProps,
  EditorProps,
  TitleProps,
} from './types'

// Client-only editor components (SSR-safe via lazy loading)
export {
  ClientBrainEditor as BrainEditor,
  ClientBrainReadOnlyEditor as BrainReadOnlyEditor,
  ClientBrainTitle as BrainTitle,
} from './ClientOnlyEditor'

// Lazy-loaded utility function that can be safely imported
// but only called on the client
export async function slateToMarkdown(content: unknown): Promise<string> {
  if (typeof window === 'undefined') {
    console.warn('slateToMarkdown should only be called on the client')
    return ''
  }
  const { slateToMarkdown: impl } = await import('./BrainEditor')
  return impl(content)
}

// Lazy-loaded getDefaultEditorValue
export async function getDefaultEditorValue(): Promise<unknown> {
  if (typeof window === 'undefined') {
    return { type: 'doc', content: [{ type: 'paragraph' }] }
  }
  const { getDefaultEditorValue: impl } = await import('./BrainEditor')
  return impl()
}

// Direct exports for when you need the raw components (must be used client-side only)
// WARNING: Only import these in client-only code
export const loadRawComponents = async () => {
  const mod = await import('./BrainEditor')
  return {
    BrainEditor: mod.BrainEditor,
    BrainReadOnlyEditor: mod.BrainReadOnlyEditor,
    BrainTitle: mod.BrainTitle,
    slateToMarkdown: mod.slateToMarkdown,
    getDefaultEditorValue: mod.getDefaultEditorValue,
    prosemirrorToMarkdown: mod.prosemirrorToMarkdown,
    markdownToProsemirror: mod.markdownToProsemirror,
  }
}
