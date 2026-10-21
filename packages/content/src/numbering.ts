import type { ContentNode } from './types'

/**
 * Numbers and labels for everything a cross-reference can point at, derived
 * from document order on every render so they're right after any edit or
 * move: figures and tables ("Figure 3", "Table 1"), numbered equations
 * ("Eq. (4)"), headings (by their text) and footnotes ("note 2").
 */

export type TargetKind = 'figure' | 'table' | 'equation' | 'heading' | 'footnote'

export type Target = {
  id: string
  kind: TargetKind
  /** "3", "4", "3.2"; null for headings. */
  number: string | null
  /** What a reference to it reads as: "Figure 3", "Eq. (4)", "Methods", "note 2". */
  label: string
  /** Caption, heading or equation source, for pickers. */
  text: string
}

export type CitationCluster = {
  items: { id: string; locator?: string; label?: string; prefix?: string; suffix?: string }[]
  mode?: 'normal' | 'suppress-author' | 'author-in-text'
}

const attrOf = (node: ContentNode, key: string) => node.attrs?.[key]

function plainText(node: ContentNode): string {
  if (typeof node.text === 'string') return node.text
  if (node.type === 'documentLink') return String(attrOf(node, 'title') ?? '')
  return (node.content ?? []).map(plainText).join('')
}

export type Numbering = {
  /** Targets by block id (and footnote id): what a cross-reference resolves. */
  targets: Map<string, Target>
  /** The target a node is, by identity; numbered even without an id. */
  of: (node: ContentNode) => Target | undefined
}

/**
 * Number figures, tables, equations, headings and footnotes in reading order.
 * Numbers follow position, so a figure without a block id (old content, or
 * not yet given one) still gets its number; only referencing it needs the id.
 */
export function numberingOf(doc: ContentNode | null | undefined): Numbering {
  const targets = new Map<string, Target>()
  const byNode = new WeakMap<ContentNode, Target>()
  const of = (node: ContentNode) => byNode.get(node)
  if (!doc) return { targets, of }
  let figures = 0
  let tables = 0
  let equations = 0
  let notes = 0

  const record = (node: ContentNode, target: Omit<Target, 'id'>, id: unknown) => {
    const full = { ...target, id: typeof id === 'string' ? id : '' }
    byNode.set(node, full)
    if (typeof id === 'string' && id) targets.set(id, full)
  }

  const walk = (node: ContentNode) => {
    const id = attrOf(node, 'id')
    switch (node.type) {
      case 'footnotes':
        return
      case 'figure': {
        const isTable = node.content?.[0]?.type === 'table'
        const number = String(isTable ? ++tables : ++figures)
        const caption = node.content?.find((child) => child.type === 'figcaption')
        record(
          node,
          {
            kind: isTable ? 'table' : 'figure',
            number,
            label: `${isTable ? 'Table' : 'Figure'} ${number}`,
            text: caption ? plainText(caption).trim() : '',
          },
          id
        )
        node.content?.forEach(walk)
        return
      }
      case 'blockMath': {
        if (attrOf(node, 'numbered') !== true) return
        // A fixed tag (\tag-style, e.g. kept from a paste) doesn't use up a number.
        const tag = attrOf(node, 'tag')
        const number = typeof tag === 'string' && tag.trim() ? tag.trim() : String(++equations)
        record(
          node,
          {
            kind: 'equation',
            number,
            label: `Eq. (${number})`,
            text: String(attrOf(node, 'latex') ?? ''),
          },
          id
        )
        return
      }
      case 'heading': {
        const text = plainText(node).trim()
        record(node, { kind: 'heading', number: null, label: text || 'Untitled section', text }, id)
        return
      }
      case 'footnoteReference': {
        const noteId = attrOf(node, 'id')
        if (typeof noteId === 'string' && !targets.has(noteId)) {
          const number = String(++notes)
          record(node, { kind: 'footnote', number, label: `note ${number}`, text: '' }, noteId)
        }
        return
      }
      default:
        node.content?.forEach(walk)
    }
  }
  walk(doc)
  return { targets, of }
}

/** Figure, table, equation, heading and footnote targets by id, in reading order. */
export function numberDocument(doc: ContentNode | null | undefined): Map<string, Target> {
  return numberingOf(doc).targets
}

/** The label shown beside a numbered equation: "(4)". */
export function equationNumber(numbering: Numbering, node: ContentNode): string | null {
  const target = numbering.of(node)
  return target?.kind === 'equation' ? `(${target.number})` : null
}

/** Every citation in reading order, as clusters for a citation processor. */
export function citationClusters(doc: ContentNode | null | undefined): CitationCluster[] {
  const clusters: CitationCluster[] = []
  const walk = (node: ContentNode) => {
    if (node.type === 'citation') {
      const items = attrOf(node, 'items')
      const mode = attrOf(node, 'mode')
      clusters.push({
        items: Array.isArray(items) ? (items as CitationCluster['items']) : [],
        mode: mode === 'suppress-author' || mode === 'author-in-text' ? mode : ('normal' as const),
      })
      return
    }
    node.content?.forEach(walk)
  }
  if (doc) walk(doc)
  return clusters
}

/** Ids of every reference cited in the document, once each, in first-cited order. */
export function citedReferenceIds(doc: ContentNode | null | undefined): string[] {
  const ids = new Set<string>()
  for (const cluster of citationClusters(doc)) {
    for (const item of cluster.items) if (item?.id) ids.add(item.id)
  }
  return [...ids]
}

/** Ids of the documents this one links to (documentLink nodes), with each link's sentence. */
export function documentLinks(
  doc: ContentNode | null | undefined
): { documentId: string; blockId: string | null; context: string }[] {
  const links: { documentId: string; blockId: string | null; context: string }[] = []
  const visitBlock = (block: ContentNode) => {
    let found = false
    const scan = (node: ContentNode) => {
      if (node.type === 'documentLink') found = true
      node.content?.forEach(scan)
    }
    block.content?.forEach(scan)
    if (!found) return
    const text = plainText(block).replace(/\s+/g, ' ').trim()
    const collect = (node: ContentNode) => {
      if (node.type === 'documentLink') {
        const documentId = attrOf(node, 'documentId')
        if (typeof documentId === 'string' && documentId) {
          const blockId = attrOf(node, 'blockId')
          links.push({
            documentId,
            blockId: typeof blockId === 'string' && blockId ? blockId : null,
            context: text.length > 280 ? `${text.slice(0, 277)}…` : text,
          })
        }
        return
      }
      node.content?.forEach(collect)
    }
    block.content?.forEach(collect)
  }
  const walk = (node: ContentNode) => {
    // Context is the nearest textblock: a paragraph, heading, list item text, caption.
    const isTextblock =
      node.type === 'paragraph' || node.type === 'heading' || node.type === 'figcaption'
    if (isTextblock) {
      visitBlock(node)
      return
    }
    node.content?.forEach(walk)
  }
  if (doc) walk(doc)
  return links
}
