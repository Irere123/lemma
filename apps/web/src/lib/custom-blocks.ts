export const CUSTOM_BLOCK_TOKEN_PREFIX = ':::lemma-block'

export type CustomBlockAttrs = Record<string, unknown>

export type CustomBlockToken = {
  attrs: CustomBlockAttrs
  index: number
  raw: string
  type: string
}

export type CustomBlockDefinition = {
  description: string
  label: string
  type: string
}

export const futureCustomBlockDefinitions: CustomBlockDefinition[] = [
  {
    type: 'button',
    label: 'Button',
    description: 'Call-to-action button with configurable URL and label.',
  },
  {
    type: 'embed',
    label: 'Embed',
    description: 'Arbitrary rich embed (tweet, video, gist, etc).',
  },
  {
    type: 'callout',
    label: 'Callout',
    description: 'Highlighted informational note with style variants.',
  },
]

const customBlockTokenPattern = /^:::lemma-block\s+({.*})\s*$/gm

export const extractCustomBlocksFromMarkdown = (markdown: string): CustomBlockToken[] => {
  if (!markdown) return []

  const blocks: CustomBlockToken[] = []
  let match: RegExpExecArray | null = customBlockTokenPattern.exec(markdown)

  while (match) {
    const raw = match[0]
    const json = match[1]

    try {
      const parsed = JSON.parse(json) as {
        attrs?: CustomBlockAttrs
        type?: string
      }

      if (typeof parsed.type === 'string' && parsed.type.length > 0) {
        blocks.push({
          index: match.index,
          raw,
          type: parsed.type,
          attrs: parsed.attrs ?? {},
        })
      }
    } catch {
      // Ignore malformed block tokens for now. Future UIs can flag these.
    }

    match = customBlockTokenPattern.exec(markdown)
  }

  return blocks
}

export const createCustomBlockToken = (type: string, attrs: CustomBlockAttrs = {}) => {
  return `${CUSTOM_BLOCK_TOKEN_PREFIX} ${JSON.stringify({ type, attrs })}`
}
