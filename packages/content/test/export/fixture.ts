import type { ContentMark, ContentNode } from '../../src'
import type { ExportBook, ExportImage, FetchImage } from '../../src/export'
import { makePng, pngDataUrl } from './helpers'

const t = (text: string, ...marks: (string | ContentMark)[]): ContentNode => {
  const node: ContentNode = { type: 'text', text }
  if (marks.length)
    node.marks = marks.map((mark) => (typeof mark === 'string' ? { type: mark } : mark))
  return node
}
const p = (...content: ContentNode[]): ContentNode => ({ type: 'paragraph', content })
const h = (level: number, text: string, id?: string): ContentNode => ({
  type: 'heading',
  attrs: id ? { level, id } : { level },
  content: [t(text)],
})
const link = (href: string): ContentMark => ({ type: 'link', attrs: { href } })
const ref = (id: string): ContentNode => ({ type: 'footnoteReference', attrs: { id } })
const note = (id: string, ...content: ContentNode[]): ContentNode => ({
  type: 'footnote',
  attrs: { id },
  content,
})
const li = (...content: ContentNode[]): ContentNode => ({ type: 'listItem', content })

export const HARBOUR_SRC = 'https://assets.example.com/harbour.png'
// Served as PNG despite the extension: the exporters must trust the bytes.
export const MAP_SRC = 'https://assets.example.com/map.jpg'
export const harbourPng = makePng(400, 300, [36, 84, 122])
export const mapPng = makePng(240, 160, [196, 160, 92])
export const sealPng = makePng(64, 64, [140, 30, 30])

export const fetchImage: FetchImage = async (src) => {
  if (src === HARBOUR_SRC) return { data: harbourPng, mediaType: 'image/png' }
  if (src === MAP_SRC) return { data: mapPng, mediaType: 'image/jpeg' }
  return null
}

const chapterOne: ContentNode = {
  type: 'doc',
  content: [
    p(
      t('The ferry came in at dawn, as it had every morning for forty years, and '),
      t('nobody', 'italic'),
      t(' on the quay looked up.')
    ),
    p(
      t('Ines counted the crates twice. The manifest said '),
      t('eleven', 'bold'),
      t(', the hold said ten, and the harbourmaster said nothing at all'),
      ref('fn-quay'),
      t('. She wrote the number in the ledger in '),
      t('red ink', { type: 'highlight', attrs: { color: '#fef08a' } }),
      t(' and underlined it '),
      t('twice', 'underline'),
      t('.')
    ),
    h(2, 'The ledger', 'ledgerheading'),
    p(
      t('The ledger kept three columns: what came in, what went out, and what was '),
      t('owed', 'strike'),
      t(' forgiven. Its spine was stamped '),
      t('MS-1904', 'code'),
      t(', and the water mark reached H'),
      t('2', 'subscript'),
      t('O level 3'),
      t('rd', 'superscript'),
      t('. A copy is kept at '),
      t('the port archive', link('https://archive.example.org/ledgers?year=1904&port=7')),
      t('.')
    ),
    {
      type: 'bulletList',
      content: [
        li(p(t('Salt cod, two crates'))),
        li(p(t('Lamp oil')), {
          type: 'bulletList',
          content: [li(p(t('Paraffin'))), li(p(t('Whale, one barrel, unmarked')))],
        }),
        li(p(t('Letters, a sack'))),
      ],
    },
    {
      type: 'orderedList',
      attrs: { start: 1, type: null },
      content: [li(p(t('Count'))), li(p(t('Sign'))), li(p(t('Seal')))],
    },
    {
      type: 'blockquote',
      content: [p(t('A harbour is a promise that the sea will give things back.'))],
    },
    p(t('Her mother used to say that, and then laugh, because it was not true.')),
    { type: 'horizontalRule' },
    p(t('By noon the missing crate had a name, and the name was Tomas.')),
    {
      type: 'figure',
      attrs: { id: 'figharbour', label: 'Figure 1' },
      content: [
        { type: 'image', attrs: { src: HARBOUR_SRC, alt: 'The harbour at dawn', width: 400 } },
        {
          type: 'figcaption',
          content: [t('The harbour at dawn, from the '), t('old', 'italic'), t(' lighthouse')],
        },
      ],
    },
    p(
      t('The tide table gave the depth as '),
      { type: 'inlineMath', attrs: { latex: 'd = h_0 + a\\sin(\\omega t)' } },
      t('.')
    ),
    {
      type: 'footnotes',
      content: [note('fn-quay', p(t('The harbourmaster had not spoken since the storm of 1921.')))],
    },
  ],
}

const chapterTwo: ContentNode = {
  type: 'doc',
  content: [
    p(
      t('Tomas wrote back on the third day'),
      ref('fn-letter'),
      t(', and again on the fifth'),
      ref('fn-letter'),
      t('. See '),
      t('the ledger', link('#ledgerheading')),
      t(' for what he owed.')
    ),
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              attrs: { colspan: 1, rowspan: 1, colwidth: [160] },
              content: [p(t('Day'))],
            },
            {
              type: 'tableHeader',
              attrs: { colspan: 1, rowspan: 1, colwidth: [200] },
              content: [p(t('Cargo'))],
            },
            {
              type: 'tableHeader',
              attrs: { colspan: 1, rowspan: 1, colwidth: [120] },
              content: [p(t('Crates'))],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 2, colwidth: [160] },
              content: [p(t('Monday'))],
            },
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: [200] },
              content: [p(t('Salt cod'))],
            },
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: [120] },
              content: [p(t('2'))],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: [200] },
              content: [p(t('Lamp oil'))],
            },
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: [120] },
              content: [p(t('3'))],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colspan: 2, rowspan: 1, colwidth: [160, 200] },
              content: [p(t('Total'))],
            },
            {
              type: 'tableCell',
              attrs: { colspan: 1, rowspan: 1, colwidth: [120] },
              content: [p(t('5'))],
            },
          ],
        },
      ],
    },
    p(t('The ferry’s draught, he wrote, followed the old rule:')),
    {
      type: 'blockMath',
      attrs: { latex: 'T = \\frac{W}{\\rho g A}', label: '(1)', id: 'eqdraught' },
    },
    {
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: true }, content: [p(t('Answer the letter'))] },
        { type: 'taskItem', attrs: { checked: false }, content: [p(t('Find the crate'))] },
      ],
    },
    {
      type: 'callout',
      attrs: { emoji: '⚓' },
      content: [p(t('Ships leave at the turn of the tide.'))],
    },
    {
      type: 'codeBlock',
      attrs: { language: null },
      content: [t('CRATE 11  -> MISSING\n\tSEE LEDGER p. 4\n')],
    },
    { type: 'youtube', attrs: { src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', start: 30 } },
    {
      type: 'footnotes',
      content: [
        note(
          'fn-letter',
          p(
            t('Both letters are in the '),
            t('port archive', link('https://archive.example.org/letters')),
            t('.')
          )
        ),
      ],
    },
  ],
}

const chapterThree: ContentNode = {
  type: 'doc',
  content: [
    h(2, 'Open water'),
    p(t('They left on the evening tide with the crate lashed to the mast.')),
    { type: 'image', attrs: { src: MAP_SRC, alt: 'Chart of the crossing' } },
    p(t('The harbour seal on the crate was still unbroken:')),
    { type: 'image', attrs: { src: pngDataUrl(sealPng), alt: 'Wax seal' } },
    {
      type: 'figure',
      attrs: { id: 'tabwinds', label: 'Table 1' },
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [p(t('Wind'))],
                },
                {
                  type: 'tableHeader',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [p(t('Knots'))],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [p(t('North-west'))],
                },
                {
                  type: 'tableCell',
                  attrs: { colspan: 1, rowspan: 1, colwidth: null },
                  content: [p(t('12'))],
                },
              ],
            },
          ],
        },
        { type: 'figcaption', content: [t('Winds on the crossing')] },
      ],
    },
    p(t('At the far shore, nobody looked up either.')),
  ],
}

export const book: ExportBook = {
  title: 'The Harbour Ledger',
  subtitle: 'A Novel in Three Tides',
  author: 'Amara Okafor-Lindqvist',
  language: 'en',
  identifier: 'urn:uuid:0c1f5a0e-5b7d-4c3e-9f7a-2d1e8b6c4a90',
  publisher: 'Lemma Press',
  date: '2026-10-01',
  description: 'A harbour clerk, a missing crate, and the sea that keeps its promises.',
  chapters: [
    { id: 'c1', title: 'The Harbour', doc: chapterOne, part: 'Part One: Arrival' },
    { id: 'c2', title: 'Letters', doc: chapterTwo, part: 'Part One: Arrival' },
    { id: 'c3', title: 'The Crossing', doc: chapterThree, part: 'Part Two: Departure' },
  ],
}

export const cover: ExportImage = { data: makePng(600, 900, [20, 40, 60]), mediaType: 'image/png' }

export const MODIFIED = new Date('2026-10-21T09:30:00Z')
