import { countWords, extractText } from '../text'
import type { ExportBook, ExportChapter } from './types'

/** Words across every chapter (notes and tables included), as a word processor counts them. */
export function countBookWords(book: Pick<ExportBook, 'chapters'>): number {
  return book.chapters.reduce((total, chapter) => total + countWords(extractText(chapter.doc)), 0)
}

/**
 * A manuscript's title-page count: "about 80,000 words". Rounded to the
 * nearest thousand, or the nearest hundred for very short works.
 */
export function approximateWordCount(words: number): string {
  if (words <= 0) return '0 words'
  const rounded =
    words >= 1000 ? Math.round(words / 1000) * 1000 : Math.max(100, Math.round(words / 100) * 100)
  return `about ${String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} words`
}

export type ChapterGroup = {
  /** The part title, or null for chapters outside any part. */
  part: string | null
  chapters: { chapter: ExportChapter; index: number }[]
}

/** Consecutive chapters that share a part, in book order. */
export function groupChapters(chapters: ExportChapter[]): ChapterGroup[] {
  const groups: ChapterGroup[] = []
  chapters.forEach((chapter, index) => {
    const part = chapter.part?.trim() || null
    const last = groups.at(-1)
    if (part && last?.part === part) last.chapters.push({ chapter, index })
    else groups.push({ part, chapters: [{ chapter, index }] })
  })
  return groups
}
