import type { Schema } from '@tiptap/pm/model'

/**
 * What a stored document depends on: node and mark names, their attributes
 * and defaults, and the content rules. Parse and render rules are left out;
 * they don't change what a document can hold.
 */
export function describeSchema(schema: Schema) {
  const attrs = (spec: Record<string, { default?: unknown }> | undefined) =>
    Object.fromEntries(
      Object.entries(spec ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, attr]) => [name, attr.default === undefined ? '(required)' : attr.default])
    )
  const nodes = Object.values(schema.nodes)
    .map((type) => ({
      name: type.name,
      group: type.spec.group ?? null,
      content: type.spec.content ?? null,
      marks: type.spec.marks ?? null,
      inline: Boolean(type.spec.inline),
      atom: Boolean(type.spec.atom),
      attrs: attrs(type.spec.attrs as Record<string, { default?: unknown }>),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const marks = Object.values(schema.marks)
    .map((type) => ({
      name: type.name,
      excludes: type.spec.excludes ?? null,
      inclusive: type.spec.inclusive ?? null,
      attrs: attrs(type.spec.attrs as Record<string, { default?: unknown }>),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { nodes, marks }
}

/** Short stable hash of describeSchema(), for the version-bump check. */
export function schemaFingerprint(schema: Schema): string {
  const text = JSON.stringify(describeSchema(schema))
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
