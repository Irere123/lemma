import { type ContentDoc, citationClusters, lowerDocument } from '@lemma/content'
import {
  type CitationCluster,
  type CslItem,
  createCitationProcessor,
  STYLES,
  type StyleId,
} from '@lemma/content/citations'
import type { FetchImage } from '@lemma/content/export'

const BACKEND = import.meta.env.VITE_PUBLIC_BACKEND_URL as string

/**
 * Images are fetched through the API (it allows only Lemma's own storage), so
 * the browser can read their bytes despite CORS and embed them in the file.
 */
export const fetchImage: FetchImage = async (src) => {
  if (src.startsWith('data:')) {
    const response = await fetch(src)
    return {
      data: new Uint8Array(await response.arrayBuffer()),
      mediaType: response.headers.get('content-type') ?? 'image/png',
    }
  }
  try {
    const response = await fetch(`${BACKEND}/export/image?src=${encodeURIComponent(src)}`, {
      credentials: 'include',
    })
    if (!response.ok) return null
    const mediaType = response.headers.get('content-type') ?? ''
    if (!mediaType.startsWith('image/')) return null
    return { data: new Uint8Array(await response.arrayBuffer()), mediaType }
  } catch {
    return null
  }
}

/** A document ready for DOCX/EPUB: citations formatted, numbers labelled. */
export function lowerForExport(
  content: ContentDoc,
  style: StyleId,
  references: CslItem[]
): ContentDoc {
  // Stored labels are validated strings; the processor knows the CSL locator labels.
  const clusters = citationClusters(content) as CitationCluster[]
  if (clusters.length === 0) return lowerDocument(content) ?? content
  const result = createCitationProcessor(style, references).process(clusters)
  return (
    lowerDocument(content, {
      citations: {
        clusters: result.clusters,
        bibliography: result.bibliography,
        numeric: STYLES.find((entry) => entry.id === style)?.kind === 'numeric',
      },
    }) ?? content
  )
}
