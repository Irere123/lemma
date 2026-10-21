// Manuscript export: EPUB 3 and DOCX, built in memory with no DOM, so the
// same code runs in the browser, a Worker or Bun. Books export every chapter;
// a research paper is a book with one chapter, exported as a 'document' DOCX.

export { approximateWordCount, countBookWords } from './book'
export { buildDocx, type DocxFormat, type DocxOptions } from './docx'
export { buildEpub, EPUB_CSS, type EpubOptions } from './epub'
export type { ContentDoc, ExportBook, ExportChapter, ExportImage, FetchImage } from './types'
export {
  htmlToXhtml,
  renderXhtml,
  texToMathml,
  type XhtmlFragment,
  type XhtmlOptions,
  type XhtmlRenderOptions,
} from './xhtml'
export { crc32, createZip, type ZipEntry, type ZipOptions } from './zip'

export const EPUB_MEDIA_TYPE = 'application/epub+zip'
export const DOCX_MEDIA_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
