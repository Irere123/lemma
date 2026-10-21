import type { ContentDoc } from '@lemma/content'
import { type CslItem, type StyleId, toBibTeX } from '@lemma/content/citations'
import { buildDocx, createZip, DOCX_MEDIA_TYPE } from '@lemma/content/export'

import { downloadBlob, fileSlug } from './download'
import { fetchImage, lowerForExport } from './shared'

/** Zotero's style repository ids for Lemma's styles, for Pandoc's `csl:`. */
const CSL_URL: Record<StyleId, string> = {
  apa: 'https://www.zotero.org/styles/apa',
  chicago: 'https://www.zotero.org/styles/chicago-author-date',
  ieee: 'https://www.zotero.org/styles/ieee',
  nature: 'https://www.zotero.org/styles/nature',
}

/** A paper as a Word document (citations and numbers resolved). */
export async function exportDocumentDocx(data: {
  title: string
  subtitle: string
  author: string
  content: ContentDoc
  citationStyle: StyleId
  references: CslItem[]
}) {
  const title = data.title || 'Untitled'
  const bytes = await buildDocx(
    {
      title,
      subtitle: data.subtitle || undefined,
      author: data.author,
      chapters: [
        {
          id: 'document',
          title,
          doc: lowerForExport(data.content, data.citationStyle, data.references),
        },
      ],
    },
    { format: 'document', fetchImage }
  )
  downloadBlob(`${fileSlug(title)}.docx`, new Blob([bytes as BlobPart], { type: DOCX_MEDIA_TYPE }))
}

const yamlString = (value: string) => JSON.stringify(value)

/**
 * Pandoc/Quarto Markdown with `[@key]` citations and a references.bib, zipped:
 * `pandoc --citeproc paper.md -o paper.pdf` or `quarto render paper.md` build it.
 */
export async function exportPandoc(data: {
  title: string
  subtitle?: string
  author: string
  markdown: string
  references: CslItem[]
  citationStyle: StyleId
}) {
  const title = data.title || 'Untitled'
  const slug = fileSlug(title)
  const hasReferences = data.references.length > 0
  const frontMatter = [
    '---',
    `title: ${yamlString(title)}`,
    data.subtitle ? `subtitle: ${yamlString(data.subtitle)}` : null,
    `author: ${yamlString(data.author)}`,
    hasReferences ? 'bibliography: references.bib' : null,
    hasReferences ? `csl: ${CSL_URL[data.citationStyle]}` : null,
    '---',
    '',
  ]
    .filter((line) => line !== null)
    .join('\n')
  const files = [{ path: `${slug}.md`, data: `${frontMatter}\n${data.markdown}` }]
  if (hasReferences) files.push({ path: 'references.bib', data: toBibTeX(data.references) })
  const zip = await createZip(files)
  downloadBlob(`${slug}-pandoc.zip`, new Blob([zip as BlobPart], { type: 'application/zip' }))
}
