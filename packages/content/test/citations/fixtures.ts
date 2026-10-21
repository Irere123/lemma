import {
  type CitationCluster,
  type CslItem,
  createCitationProcessor,
  type StyleId,
} from '../../src/citations'

/** The bibliography entry for one item cited on its own. */
export function entryFor(style: StyleId, item: CslItem): { text: string; html: string } {
  const result = createCitationProcessor(style, [item]).process([{ items: [{ id: item.id }] }])
  const entry = result.bibliography[0]!
  return { text: entry.text, html: entry.html }
}

/** Plain-text in-text citations for the given clusters. */
export function citeText(
  style: StyleId,
  library: CslItem[],
  clusters: CitationCluster[]
): string[] {
  return createCitationProcessor(style, library)
    .process(clusters)
    .clusters.map((c) => c.text)
}

export function one(id: string, extra: Omit<CitationCluster['items'][number], 'id'> = {}) {
  return { items: [{ id, ...extra }] }
}

// One item per kind of work, used by the golden tests of every style.

export const article: CslItem = {
  id: 'smith2020deep',
  type: 'article-journal',
  title: 'The deep learning revolution',
  'container-title': 'Journal of Machine Learning Research',
  author: [
    { family: 'Smith', given: 'John' },
    { family: 'Jones', given: 'Jane' },
    { family: 'Lee', given: 'Kim' },
  ],
  issued: { 'date-parts': [[2020, 3]] },
  volume: '12',
  issue: '3',
  page: '45-67',
  DOI: '10.1000/jmlr.2020.123',
}

export const book: CslItem = {
  id: 'knuth1997art',
  type: 'book',
  title: 'The art of computer programming',
  author: [{ family: 'Knuth', given: 'Donald E.' }],
  issued: { 'date-parts': [[1997]] },
  edition: '3',
  publisher: 'Addison-Wesley',
  'publisher-place': 'Reading, MA',
}

export const chapter: CslItem = {
  id: 'brown2018neural',
  type: 'chapter',
  title: 'Neural networks in practice',
  'container-title': 'Handbook of artificial intelligence',
  author: [{ family: 'Brown', given: 'Alice' }],
  editor: [
    { family: 'Green', given: 'Peter' },
    { family: 'White', given: 'Sarah' },
  ],
  issued: { 'date-parts': [[2018]] },
  page: '101-125',
  publisher: 'Springer',
  'publisher-place': 'Berlin',
  DOI: '10.1007/978-3-319-00000-0_5',
}

export const report: CslItem = {
  id: 'who2021global',
  type: 'report',
  title: 'Global report on infection prevention and control',
  author: [{ literal: 'World Health Organization' }],
  issued: { 'date-parts': [[2021]] },
  number: '12',
  publisher: 'World Health Organization',
  'publisher-place': 'Geneva',
  URL: 'https://www.who.int/publications/i/item/9789240051164',
}

export const thesis: CslItem = {
  id: 'garcia2019learning',
  type: 'thesis',
  title: 'Learning to see in the dark',
  author: [{ family: 'Garcia', given: 'Maria' }],
  issued: { 'date-parts': [[2019]] },
  genre: 'PhD thesis',
  publisher: 'Stanford University',
  URL: 'https://purl.stanford.edu/abc123',
}

export const webpage: CslItem = {
  id: 'doe2023how',
  type: 'webpage',
  title: 'How transformers work',
  'container-title': 'The Gradient',
  author: [{ family: 'Doe', given: 'Jane' }],
  issued: { 'date-parts': [[2023, 5, 14]] },
  URL: 'https://thegradient.pub/transformers',
  accessed: { 'date-parts': [[2024, 1, 10]] },
}

export const preprint: CslItem = {
  id: 'vaswani2017attention',
  type: 'article',
  title: 'Attention is all you need',
  'container-title': 'arXiv',
  archive: 'arXiv',
  author: [
    { family: 'Vaswani', given: 'Ashish' },
    { family: 'Shazeer', given: 'Noam' },
  ],
  issued: { 'date-parts': [[2017, 6, 12]] },
  number: 'arXiv:1706.03762',
  DOI: '10.48550/arXiv.1706.03762',
  URL: 'https://arxiv.org/abs/1706.03762',
}

export const KINDS = { article, book, chapter, report, thesis, webpage, preprint }

export const LIBRARY: CslItem[] = Object.values(KINDS)
