import type { CslItem, CslName } from './csl'
import { foldAscii, stripMarkup } from './util'

// Function words skipped when picking the title word of a key (English plus
// the most common articles and prepositions of other languages).
const STOP_WORDS = new Set(
  (
    'a an the of on in at to for and or nor but with without from by as is are was were be been ' +
    'into onto upon via about over under its it this that these those toward towards what when ' +
    'where why how do does not no vs versus than then there their our your his her my we you ' +
    'der die das den dem des ein eine und oder le la les l un une de du et ou el los las ' +
    'il lo gli i y o da di del della per con'
  ).split(' ')
)

function asciiWords(value: string): string[] {
  return foldAscii(stripMarkup(value))
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function nameKey(name: CslName | undefined): string {
  if (!name) return ''
  if (name.family) return asciiWords(name.family).join('')
  // Institutions: their first significant word ("World Health Organization" → world).
  const words = asciiWords(name.literal ?? '')
  return words.find((w) => !STOP_WORDS.has(w)) ?? words[0] ?? ''
}

// Single letters ("E. coli", "A") are never the word a key is built from.
function significantWords(title: string | undefined): string[] {
  return asciiWords(title ?? '').filter((w) => !STOP_WORDS.has(w) && (w.length > 1 || /\d/.test(w)))
}

// a … z, aa, ab … (spreadsheet-column style).
function suffix(n: number): string {
  let out = ''
  let i = n
  do {
    out = String.fromCharCode(97 + (i % 26)) + out
    i = Math.floor(i / 26) - 1
  } while (i >= 0)
  return out
}

/**
 * A Better-BibTeX-style key: first author's family name + year + first
 * significant title word, ASCII-folded and lowercased (Smith 2020 "The Deep
 * Learning Revolution" → `smith2020deep`). Without authors, editors are used,
 * then the first title word. Collisions get a, b, c … suffixes; the returned
 * key is added to `taken`.
 */
export function makeCiteKey(item: CslItem, taken: Set<string>): string {
  const titleWords = significantWords(item.title)
  let lead = nameKey(item.author?.[0]) || nameKey(item.editor?.[0])
  let word = titleWords[0] ?? ''
  if (!lead) {
    lead = word
    word = titleWords[1] ?? ''
  }
  const year = item.issued?.['date-parts']?.[0]?.[0]
  const base = `${lead}${year ?? ''}${word}` || 'ref'

  let key = base
  for (let n = 0; taken.has(key); n++) key = base + suffix(n)
  taken.add(key)
  return key
}
