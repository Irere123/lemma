// Find (and replace) across a writer's documents: a literal search, never a
// user-supplied regular expression.

export type TextSearch = { find: string; caseSensitive?: boolean; wholeWord?: boolean }

/** The literal search as a global RegExp (null for an empty search). */
export function searchPattern({ find, caseSensitive, wholeWord }: TextSearch): RegExp | null {
  if (!find) return null
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const source = wholeWord ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])` : escaped
  return new RegExp(source, caseSensitive ? 'gu' : 'giu')
}
