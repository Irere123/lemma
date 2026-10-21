import type { CslItem, CslName } from './csl'
import {
  dateBits,
  doiUrl,
  edition,
  familyName,
  formatLocator,
  invertedWithInitials,
  joinList,
  kindOf,
  type LocatorLabel,
  type NumericStyle,
  pageRange,
  repositoryOf,
  thesisKind,
} from './format-common'
import { cat, dot, italic, join, type Rich, wrap } from './rich'

// Nature's reference style (nature.com/nature/for-authors/formatting-guide).
// Volumes are bold in print; our HTML is limited to <i> and <sup>, so they
// are plain here. Journal articles carry no DOI, as in the printed journal;
// web resources, preprints and datasets end with their address.

const TERMS: Record<LocatorLabel, [string, string]> = {
  page: ['p.', 'pp.'],
  chapter: ['ch.', 'chs.'],
  section: ['sec.', 'secs.'],
  figure: ['fig.', 'figs.'],
  paragraph: ['para.', 'paras.'],
  line: ['line', 'lines'],
  volume: ['vol.', 'vols.'],
}

// Up to five authors, else the first followed by et al.; "&" before the last.
function nameList(names: CslName[]): string {
  if (names.length > 5) return `${invertedWithInitials(names[0]!, ' ')} et al.`
  return joinList(
    names.map((n) => invertedWithInitials(n, ' ')),
    { last: ' & ' }
  )
}

function editionText(value: string | undefined): string {
  const ed = edition(value)
  if (!ed) return ''
  return ed.numeric ? `${ed.text} edn` : ed.text
}

function authors(item: CslItem): string {
  if (item.author?.length) return nameList(item.author)
  const kind = kindOf(item)
  if (item.editor?.length && kind !== 'part' && kind !== 'periodical') {
    return `${nameList(item.editor)} (${item.editor.length > 1 ? 'eds' : 'ed.'})`
  }
  return ''
}

/** "(Publisher, 2020)." — or just a period when both are missing. */
function closing(...values: (string | undefined)[]): Rich {
  return cat(wrap(' (', join(values, ', '), ')'), '.')
}

function entry(item: CslItem): Rich {
  const kind = kindOf(item)
  const year = dateBits(item.issued).year?.toString()
  const lead = authors(item)
  // "Smith, J. Title." but "Smith, J. (ed.) *Title*" — no period after the role.
  const head = (title: Rich): Rich => join([lead.endsWith(')') ? lead : dot(lead), title], ' ')
  const title = item.title ?? ''
  const container = item['container-title']

  switch (kind) {
    case 'periodical': {
      // Smith, J. & Jones, K. Title. *Journal* 12, 45–67 (2020).
      const numbers = join([item.volume, item.page ? pageRange(item.page) : item.number], ', ')
      const source = join([italic(container), numbers], ' ')
      return cat(join([head(dot(title)), source], ' '), closing(year))
    }
    case 'part': {
      // Smith, J. Title. in *Book* (eds Editor, A. & Other, B.) 45–67 (Publisher, 2020).
      const eds = item.editor?.length
        ? `${item.editor.length > 1 ? 'eds' : 'ed.'} ${joinList(
            item.editor.map((n) => invertedWithInitials(n, ' ')),
            { last: ' & ' }
          )}`
        : ''
      const inPart = join(
        [
          container && cat('in ', italic(container)),
          wrap('(', eds, ')'),
          item.page && pageRange(item.page),
        ],
        ' '
      )
      return cat(join([head(dot(title)), inPart], ' '), closing(item.publisher, year))
    }
    case 'thesis': {
      const t = thesisKind(item.genre)
      const label =
        t === 'phd' ? 'PhD thesis' : t === 'masters' ? "Master's thesis" : (item.genre ?? 'Thesis')
      return cat(head(dot(italic(title))), ' ', join([label, item.publisher], ', '), closing(year))
    }
    case 'webpage': {
      // Title. *Site* https://… (2020).
      const site = container ?? item.publisher
      const body = join([head(dot(title)), italic(site), item.URL], ' ')
      return year ? cat(body, closing(year)) : body
    }
    case 'preprint': {
      // Preprint at https://arxiv.org/abs/… (2023).
      const address = item.URL ?? (item.DOI ? doiUrl(item.DOI) : undefined)
      const body = join([head(dot(title)), address ? `Preprint at ${address}` : 'Preprint'], ' ')
      return cat(body, closing(year))
    }
    default: {
      if (item.type === 'dataset') {
        const address = item.DOI ? doiUrl(item.DOI) : item.URL
        const body = join([head(dot(title)), italic(repositoryOf(item)), address], ' ')
        return year ? cat(body, closing(year)) : body
      }
      // Books, reports and other stand-alone works: *Title* 2nd edn (Publisher, 2020).
      const report =
        kind === 'report' && item.number ? `${item.genre ?? 'Report'} No. ${item.number}` : ''
      const titled = report
        ? join([dot(italic(title)), report], ' ')
        : join([italic(title), editionText(item.edition)], ' ')
      return cat(head(titled), closing(item.publisher, year))
    }
  }
}

export const nature: NumericStyle = {
  kind: 'numeric',
  citeNames(item) {
    const list = item.author?.length ? item.author : (item.editor ?? [])
    if (!list.length) return null
    if (list.length === 1) return familyName(list[0]!)
    if (list.length === 2) return `${familyName(list[0]!)} and ${familyName(list[1]!)}`
    return `${familyName(list[0]!)} et al.`
  },
  locator: (ref) => formatLocator(ref, TERMS),
  entry,
  label: (n) => `${n}. `,
  superscript: true,
}
