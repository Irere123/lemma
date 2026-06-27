// Structural ProseMirror/Tiptap types, defined locally to keep this package
// zero-dependency and Worker-safe. Compatible with Tiptap's editor.getJSON().
export interface ContentMark {
  type: string
  attrs?: Record<string, unknown> | null
}

export interface ContentNode {
  type?: string
  attrs?: Record<string, unknown> | null
  content?: ContentNode[] | null
  marks?: ContentMark[] | null
  text?: string | null
}

export type ContentDoc = ContentNode

export interface ContentSummary {
  text: string
  words: number
  readingTime: string
  excerpt: string
}
