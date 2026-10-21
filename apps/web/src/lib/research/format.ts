import { type CslItem, createCitationProcessor, type StyleId } from '@lemma/content/citations'

/** One library item as its bibliography entry in a style (for lists and pickers). */
export function formatReference(item: CslItem, style: StyleId): { text: string; html: string } {
  const result = createCitationProcessor(style, [item]).process([{ items: [{ id: item.id }] }])
  const entry = result.bibliography[0]
  return entry ? { text: entry.text, html: entry.html } : { text: item.title ?? item.id, html: '' }
}

const names = (item: CslItem) =>
  [...(item.author ?? []), ...(item.editor ?? [])]
    .map((name) => name.literal ?? [name.given, name.family].filter(Boolean).join(' '))
    .join(' ')

const year = (item: CslItem) => String(item.issued?.['date-parts']?.[0]?.[0] ?? '')

/** Lower-cased text a library search matches against. */
export function referenceSearchText(entry: { key: string; csl: CslItem }) {
  const { csl } = entry
  return [entry.key, csl.title, csl['container-title'], names(csl), year(csl), csl.DOI]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** "Smith & Jones 2020" — a compact label for chips and menus. */
export function shortReference(item: CslItem) {
  const authors = item.author ?? item.editor ?? []
  const family = (index: number) => {
    const name = authors[index]
    return name?.family ?? name?.literal ?? ''
  }
  const who =
    authors.length === 0
      ? (item.title ?? 'Untitled')
      : authors.length === 1
        ? family(0)
        : authors.length === 2
          ? `${family(0)} & ${family(1)}`
          : `${family(0)} et al.`
  const when = year(item)
  return when ? `${who} ${when}` : who
}
