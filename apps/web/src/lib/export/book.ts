import type { ContentDoc } from '@lemma/content'
import type { CslItem, StyleId } from '@lemma/content/citations'
import { buildDocx, buildEpub, DOCX_MEDIA_TYPE, EPUB_MEDIA_TYPE } from '@lemma/content/export'

import { downloadBlob, fileSlug } from './download'
import { fetchImage, lowerForExport } from './shared'

export type BookExportData = {
  book: {
    title: string
    subtitle: string | null
    description: string | null
    coverImage: string | null
  }
  author: string
  chapters: {
    id: string
    title: string
    part?: string
    content: ContentDoc
    citationStyle: StyleId
  }[]
  references: CslItem[]
}

/** Build the whole manuscript in the browser and download it. */
export async function exportBook(data: BookExportData, format: 'epub' | 'docx') {
  const cover = data.book.coverImage ? await fetchImage(data.book.coverImage) : null
  const book = {
    title: data.book.title || 'Untitled book',
    subtitle: data.book.subtitle ?? undefined,
    description: data.book.description ?? undefined,
    author: data.author,
    language: document.documentElement.lang || 'en',
    date: new Date().toISOString(),
    cover: cover ?? undefined,
    chapters: data.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title || 'Untitled chapter',
      part: chapter.part,
      doc: lowerForExport(chapter.content, chapter.citationStyle, data.references),
    })),
  }
  if (book.chapters.length === 0) throw new Error('This book has no chapters to export yet.')
  const bytes =
    format === 'epub'
      ? await buildEpub(book, { fetchImage })
      : await buildDocx(book, { format: 'manuscript', fetchImage })
  downloadBlob(
    `${fileSlug(book.title, 'book')}.${format}`,
    new Blob([bytes as BlobPart], { type: format === 'epub' ? EPUB_MEDIA_TYPE : DOCX_MEDIA_TYPE })
  )
}
