import { describe, expect, test } from 'bun:test'
import type { Document, Element } from '@xmldom/xmldom'

import {
  approximateWordCount,
  buildDocx,
  countBookWords,
  type DocxOptions,
  type ExportBook,
} from '../../src/export'
import { book, fetchImage, MODIFIED } from './fixture'
import {
  all,
  children,
  NS,
  one,
  ooxmlOrderErrors,
  parseXml,
  resolvePath,
  textOf,
  unzip,
  utf8,
} from './helpers'

type Docx = {
  files: Record<string, Uint8Array>
  xml: Map<string, Document>
  part: (path: string) => Document
  rels: (part: string) => Map<string, { type: string; target: string; external: boolean }>
  body: Element
  paragraphs: Element[]
}

async function open(input: ExportBook, options: DocxOptions = {}): Promise<Docx> {
  const files = unzip(await buildDocx(input, { modified: MODIFIED, ...options }))
  const xml = new Map<string, Document>()
  for (const [path, data] of Object.entries(files)) {
    if (/\.(xml|rels)$/.test(path)) xml.set(path, parseXml(utf8(data), path))
  }
  const part = (path: string) => {
    const found = xml.get(path)
    if (!found) throw new Error(`missing ${path}`)
    return found
  }
  const rels = (path: string) => {
    const relsPath = path ? path.replace(/([^/]+)$/, '_rels/$1.rels') : '_rels/.rels'
    const doc = xml.get(relsPath)
    return new Map(
      (doc ? all(doc, NS.pr, 'Relationship') : []).map((rel) => [
        rel.getAttribute('Id') ?? '',
        {
          type: (rel.getAttribute('Type') ?? '').split('/').at(-1) ?? '',
          target: rel.getAttribute('Target') ?? '',
          external: rel.getAttribute('TargetMode') === 'External',
        },
      ])
    )
  }
  const body = one(part('word/document.xml'), NS.w, 'body')
  return { files, xml, part, rels, body, paragraphs: children(body, NS.w, 'p') }
}

const val = (element: Element | undefined, name = 'val') =>
  element?.getAttributeNS(NS.w, name) ?? null
const prop = (p: Element, name: string) => {
  const pPr = children(p, NS.w, 'pPr')[0]
  return pPr ? children(pPr, NS.w, name)[0] : undefined
}
const styleOf = (p: Element) => val(prop(p, 'pStyle'))
const text = (root: Element) => all(root, NS.w, 't').map(textOf).join('')
const withStyle = (docx: Docx, style: string) => docx.paragraphs.filter((p) => styleOf(p) === style)

const REQUIRED_PARTS = [
  '[Content_Types].xml',
  '_rels/.rels',
  'docProps/core.xml',
  'docProps/app.xml',
  'word/document.xml',
  'word/styles.xml',
  'word/settings.xml',
  'word/numbering.xml',
  'word/footnotes.xml',
  'word/header1.xml',
  'word/_rels/document.xml.rels',
]

describe('DOCX manuscript', async () => {
  const docx = await open(book, { fetchImage })

  test('has every required part, each with its content type', () => {
    for (const path of REQUIRED_PARTS) expect(docx.files[path]).toBeDefined()
    const types = docx.part('[Content_Types].xml')
    const overrides = new Map(
      all(types, NS.ct, 'Override').map((el) => [
        el.getAttribute('PartName'),
        el.getAttribute('ContentType'),
      ])
    )
    const defaults = new Map(
      all(types, NS.ct, 'Default').map((el) => [
        el.getAttribute('Extension'),
        el.getAttribute('ContentType'),
      ])
    )
    expect(overrides.get('/word/document.xml')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
    )
    expect(overrides.get('/word/footnotes.xml')).toContain('footnotes+xml')
    expect(overrides.get('/word/header1.xml')).toContain('header+xml')
    expect(overrides.get('/docProps/core.xml')).toContain('core-properties+xml')
    for (const name of Object.keys(docx.files)) {
      if (name === '[Content_Types].xml') continue
      const typed = overrides.has(`/${name}`) || defaults.has(name.split('.').at(-1) ?? '')
      expect(typed).toBe(true)
    }
    for (const part of overrides.keys()) expect(docx.files[(part ?? '').slice(1)]).toBeDefined()
    expect(defaults.get('png')).toBe('image/png')
  })

  test('every part parses strictly and keeps schema element order', () => {
    expect(docx.xml.size).toBeGreaterThanOrEqual(REQUIRED_PARTS.length)
    for (const [path, doc] of docx.xml) {
      if (path.startsWith('word/') && path.endsWith('.xml')) {
        expect({ path, errors: ooxmlOrderErrors(doc) }).toEqual({ path, errors: [] })
      }
    }
  })

  test('relationships resolve, and every r:id in a part is declared', () => {
    const root = docx.rels('')
    expect([...root.values()].map((rel) => rel.target).sort()).toEqual([
      'docProps/app.xml',
      'docProps/core.xml',
      'word/document.xml',
    ])
    for (const part of ['word/document.xml', 'word/footnotes.xml']) {
      const rels = docx.rels(part)
      for (const rel of rels.values()) {
        if (!rel.external) expect(docx.files[resolvePath(part, rel.target)]).toBeDefined()
      }
      const used = all(docx.part(part), NS.w, '*')
        .concat(all(docx.part(part), NS.a, 'blip'))
        .flatMap((el) => [el.getAttributeNS(NS.r, 'id'), el.getAttributeNS(NS.r, 'embed')])
        .filter((id): id is string => Boolean(id))
      expect(used.length).toBeGreaterThan(0)
      for (const id of used) expect(rels.has(id)).toBe(true)
    }
  })

  test('opens with a title page: name and word count, then the title halfway down', () => {
    const [info, title, subtitle, byline] = docx.paragraphs
    const words = countBookWords(book)
    expect(words).toBeGreaterThan(250)
    expect(styleOf(info as Element)).toBe('TitlePageInfo')
    expect(text(info as Element)).toBe(`${book.author}${approximateWordCount(words)}`)
    expect(approximateWordCount(words)).toMatch(/^about \d{3} words$/)
    expect(all(info as Element, NS.w, 'tab')).toHaveLength(2) // the tab stop and the tab
    expect(styleOf(title as Element)).toBe('Title')
    expect(text(title as Element)).toBe(book.title)
    expect(Number(val(prop(title as Element, 'spacing'), 'before'))).toBeGreaterThan(4000)
    expect(text(subtitle as Element)).toBe(book.subtitle ?? '')
    expect(text(byline as Element)).toBe(`by ${book.author}`)
    // The title page is its own section, with no running head.
    const firstSection = prop(byline as Element, 'sectPr')
    expect(firstSection).toBeDefined()
    expect(all(firstSection as Element, NS.w, 'headerReference')).toHaveLength(0)
  })

  test('runs the "Surname / Title / page" header from the first page of text', () => {
    const header = docx.part('word/header1.xml')
    const p = one(header, NS.w, 'p')
    expect(text(p)).toBe('Okafor-Lindqvist / The Harbour Ledger / 1')
    expect(val(prop(p, 'jc'))).toBe('right')
    expect(textOf(one(header, NS.w, 'instrText')).trim()).toBe('PAGE')
    const section = children(docx.body, NS.w, 'sectPr')[0] as Element
    const reference = one(section, NS.w, 'headerReference')
    expect(val(reference, 'type')).toBe('default')
    const rel = docx.rels('word/document.xml').get(reference.getAttributeNS(NS.r, 'id') ?? '')
    expect(rel).toEqual({ type: 'header', target: 'header1.xml', external: false })
    expect(val(one(section, NS.w, 'pgNumType'), 'start')).toBe('1')
    expect(val(one(section, NS.w, 'pgMar'), 'top')).toBe('1440')
  })

  test('starts each part and chapter on a new page, a third of the way down', () => {
    const parts = withStyle(docx, 'PartTitle')
    const chapters = withStyle(docx, 'ChapterTitle')
    expect(parts.map(text)).toEqual(['Part One: Arrival', 'Part Two: Departure'])
    expect(chapters.map(text)).toEqual(book.chapters.map((chapter) => chapter.title))
    const breaks = [...parts, ...chapters].map((p) => prop(p, 'pageBreakBefore') !== undefined)
    // The first part follows the title page's section break; everything else breaks.
    expect(breaks).toEqual([false, true, true, true, true])
    for (const p of [...parts, ...chapters]) {
      expect(Number(val(prop(p, 'spacing'), 'before'))).toBe(Math.round(15840 / 3) - 1440)
    }
    expect(chapters.map((p) => val(prop(p, 'outlineLvl')))).toEqual(['1', '1', '1'])
  })

  test('indents body paragraphs except the first after a heading or scene break', () => {
    const index = (p: Element) => docx.paragraphs.indexOf(p)
    // The first body paragraph of each chapter (chapter three opens with a heading).
    for (const title of withStyle(docx, 'ChapterTitle')) {
      const next = docx.paragraphs
        .slice(index(title) + 1)
        .find((p) => !styleOf(p)?.startsWith('Heading')) as Element
      expect(styleOf(next)).toBe('FirstParagraph')
    }
    const breaks = withStyle(docx, 'SceneBreak').filter((p) => text(p) === '#')
    expect(breaks).toHaveLength(1)
    expect(
      val(
        one(docx.part('word/styles.xml'), NS.w, 'docDefaults').getElementsByTagNameNS(
          NS.w,
          'spacing'
        )[0],
        'line'
      )
    ).toBe('480')
    const afterBreak = docx.paragraphs[index(breaks[0] as Element) + 1] as Element
    expect(styleOf(afterBreak)).toBe('FirstParagraph')
    expect(text(afterBreak)).toStartWith('By noon')
    const second = docx.paragraphs.find((p) => text(p).startsWith('Ines counted')) as Element
    expect(styleOf(second)).toBe('BodyText')
    const heading = docx.paragraphs.find((p) => text(p) === 'The ledger') as Element
    // Part, chapter, then the document's own levels: its h2 sits two below the chapter.
    expect(styleOf(heading)).toBe('Heading4')
    expect(styleOf(docx.paragraphs[index(heading) + 1] as Element)).toBe('FirstParagraph')
  })

  test('ends with END', () => {
    const last = docx.paragraphs.at(-1) as Element
    expect(text(last)).toBe('END')
    expect(styleOf(last)).toBe('SceneBreak')
  })

  test('puts footnotes in footnotes.xml and references them', () => {
    const notes = all(docx.part('word/footnotes.xml'), NS.w, 'footnote')
    expect(notes.map((note) => val(note, 'type'))).toEqual([
      'separator',
      'continuationSeparator',
      null,
      null,
    ])
    const bodies = new Map(
      notes.filter((note) => !val(note, 'type')).map((note) => [val(note, 'id'), note])
    )
    const refs = all(docx.body, NS.w, 'footnoteReference').map((ref) => val(ref, 'id'))
    expect(refs).toEqual(['1', '2'])
    for (const id of refs) expect(bodies.has(id)).toBe(true)
    expect(text(bodies.get('1') as Element)).toBe(
      ' The harbourmaster had not spoken since the storm of 1921.'
    )
    expect(all(bodies.get('1') as Element, NS.w, 'footnoteRef')).toHaveLength(1)
    // The second reference to the same note repeats its number.
    const letters = docx.paragraphs.find((p) => text(p).startsWith('Tomas wrote back')) as Element
    const marks = all(letters, NS.w, 'r').filter(
      (r) => val(all(r, NS.w, 'rStyle')[0]) === 'FootnoteReference'
    )
    expect(marks.map((r) => (all(r, NS.w, 'footnoteReference').length ? 'ref' : text(r)))).toEqual([
      'ref',
      '2',
    ])
    // A link inside a note gets its relationship on the footnotes part.
    const noteLink = one(bodies.get('2') as Element, NS.w, 'hyperlink')
    const rel = docx.rels('word/footnotes.xml').get(noteLink.getAttributeNS(NS.r, 'id') ?? '')
    expect(rel).toEqual({
      type: 'hyperlink',
      target: 'https://archive.example.org/letters',
      external: true,
    })
    expect(
      all(docx.part('word/settings.xml'), NS.w, 'footnote').map((el) => val(el, 'id'))
    ).toEqual(['-1', '0'])
  })

  test('numbers lists through numbering.xml, with nesting', () => {
    const numbering = docx.part('word/numbering.xml')
    const nums = new Map(
      all(numbering, NS.w, 'num').map((num) => [
        val(num, 'numId'),
        val(one(num, NS.w, 'abstractNumId')),
      ])
    )
    const abstracts = new Map(
      all(numbering, NS.w, 'abstractNum').map((el) => [val(el, 'abstractNumId'), el])
    )
    const level = (p: Element) => {
      const numPr = prop(p, 'numPr') as Element
      const abstract = abstracts.get(nums.get(val(one(numPr, NS.w, 'numId'))) ?? '') as Element
      const ilvl = val(one(numPr, NS.w, 'ilvl'))
      const lvl = all(abstract, NS.w, 'lvl').find((el) => val(el, 'ilvl') === ilvl) as Element
      return { ilvl, format: val(one(lvl, NS.w, 'numFmt')), text: val(one(lvl, NS.w, 'lvlText')) }
    }
    const items = docx.paragraphs.filter((p) => prop(p, 'numPr'))
    expect(items.map((p) => [text(p), level(p)])).toEqual([
      ['Salt cod, two crates', { ilvl: '0', format: 'bullet', text: '•' }],
      ['Lamp oil', { ilvl: '0', format: 'bullet', text: '•' }],
      ['Paraffin', { ilvl: '1', format: 'bullet', text: '◦' }],
      ['Whale, one barrel, unmarked', { ilvl: '1', format: 'bullet', text: '◦' }],
      ['Letters, a sack', { ilvl: '0', format: 'bullet', text: '•' }],
      ['Count', { ilvl: '0', format: 'decimal', text: '%1.' }],
      ['Sign', { ilvl: '0', format: 'decimal', text: '%1.' }],
      ['Seal', { ilvl: '0', format: 'decimal', text: '%1.' }],
      ['Answer the letter', { ilvl: '0', format: 'bullet', text: '☒' }],
      ['Find the crate', { ilvl: '0', format: 'bullet', text: '☐' }],
    ])
    const nested = items[2] as Element
    expect(val(prop(nested, 'ind'), 'left')).toBe('1440')
    // Distinct list identities, so Word never merges two lists.
    const nsids = all(numbering, NS.w, 'nsid').map((el) => val(el))
    expect(new Set(nsids).size).toBe(nsids.length)
  })

  test('turns links into hyperlink relationships and in-book links into bookmarks', () => {
    const rels = docx.rels('word/document.xml')
    const links = all(docx.body, NS.w, 'hyperlink')
    const external = links
      .filter((link) => link.getAttributeNS(NS.r, 'id'))
      .map((link) => [text(link), rels.get(link.getAttributeNS(NS.r, 'id') ?? '')])
    expect(external).toContainEqual([
      'the port archive',
      {
        type: 'hyperlink',
        target: 'https://archive.example.org/ledgers?year=1904&port=7',
        external: true,
      },
    ])
    const internal = links.find((link) => text(link) === 'the ledger') as Element
    const anchor = val(internal, 'anchor')
    expect(anchor).toBe('ledgerheading')
    const bookmark = all(docx.body, NS.w, 'bookmarkStart').find((el) => val(el, 'name') === anchor)
    const heading = bookmark?.parentNode as Element
    expect(text(heading)).toBe('The ledger')
    const ids = all(docx.body, NS.w, 'bookmarkStart').map((el) => val(el, 'id'))
    expect(all(docx.body, NS.w, 'bookmarkEnd').map((el) => val(el, 'id'))).toEqual(ids)
  })

  test('embeds images as inline drawings, sized from the editor width or the file', () => {
    const drawings = all(docx.body, NS.wp, 'inline')
    const sizes = drawings.map((inline) => {
      const extent = one(inline, NS.wp, 'extent')
      return [Number(extent.getAttribute('cx')) / 9525, Number(extent.getAttribute('cy')) / 9525]
    })
    // 400 px wide (aspect from the file), the map's own 240×160, the seal's 64×64.
    expect(sizes).toEqual([
      [400, 300],
      [240, 160],
      [64, 64],
    ])
    const rels = docx.rels('word/document.xml')
    const targets = all(docx.body, NS.a, 'blip').map(
      (blip) => rels.get(blip.getAttributeNS(NS.r, 'embed') ?? '')?.target
    )
    expect(targets).toEqual(['media/image1.png', 'media/image2.png', 'media/image3.png'])
    const ids = all(docx.body, NS.wp, 'docPr').map((el) => el.getAttribute('id'))
    expect(new Set(ids).size).toBe(ids.length)
    expect(all(docx.body, NS.wp, 'docPr')[0]?.getAttribute('descr')).toBe('The harbour at dawn')
  })

  test('follows a figure with its caption paragraph', () => {
    const captions = withStyle(docx, 'Caption')
    expect(captions.map(text)).toEqual([
      'Figure 1. The harbour at dawn, from the old lighthouse',
      'Table 1. Winds on the crossing',
    ])
    const image = docx.paragraphs[docx.paragraphs.indexOf(captions[0] as Element) - 1] as Element
    expect(all(image, NS.wp, 'inline')).toHaveLength(1)
    expect(prop(image, 'keepNext')).toBeDefined()
    // The table figure: the caption follows the table.
    expect((captions[1]?.previousSibling as Element | null)?.localName).toBe('tbl')
  })

  test('writes tables with borders, a repeating header row and merged cells', () => {
    const table = all(docx.body, NS.w, 'tbl')[0] as Element
    expect(all(one(table, NS.w, 'tblBorders'), NS.w, 'insideH')).toHaveLength(1)
    expect(all(one(table, NS.w, 'tblGrid'), NS.w, 'gridCol').map((col) => val(col, 'w'))).toEqual([
      '2400',
      '3000',
      '1800',
    ])
    const rows = children(table, NS.w, 'tr')
    expect(rows.map((row) => children(row, NS.w, 'tc').length)).toEqual([3, 3, 3, 2])
    expect(all(rows[0] as Element, NS.w, 'tblHeader')).toHaveLength(1)
    expect(all(rows[1] as Element, NS.w, 'tblHeader')).toHaveLength(0)
    expect(all(rows[0] as Element, NS.w, 'b').length).toBeGreaterThan(0)
    expect(val(all(rows[1] as Element, NS.w, 'vMerge')[0])).toBe('restart')
    expect(all(rows[2] as Element, NS.w, 'vMerge')[0]?.hasAttributeNS(NS.w, 'val')).toBe(false)
    expect(val(all(rows[3] as Element, NS.w, 'gridSpan')[0])).toBe('2')
    for (const tc of all(table, NS.w, 'tc')) expect((tc.lastChild as Element).localName).toBe('p')
  })

  test('writes math as TeX in Cambria Math, with equation labels', () => {
    const styles = docx.part('word/styles.xml')
    const math = all(styles, NS.w, 'style').find((el) => val(el, 'styleId') === 'Math') as Element
    expect(one(math, NS.w, 'rFonts').getAttributeNS(NS.w, 'ascii')).toBe('Cambria Math')
    const inline = all(docx.body, NS.w, 'r').find((r) => val(all(r, NS.w, 'rStyle')[0]) === 'Math')
    expect(text(inline as Element)).toBe('d = h_0 + a\\sin(\\omega t)')
    const equation = withStyle(docx, 'Equation')[0] as Element
    expect(text(equation)).toBe('T = \\frac{W}{\\rho g A}(1)')
    expect(all(one(equation, NS.w, 'tabs'), NS.w, 'tab').map((tab) => val(tab))).toEqual([
      'center',
      'right',
    ])
  })

  test('renders callouts, code, quotes and videos', () => {
    const callout = docx.paragraphs.find((p) => text(p).includes('turn of the tide')) as Element
    expect(text(callout)).toBe('⚓ Ships leave at the turn of the tide.')
    expect(prop(callout, 'pBdr')).toBeDefined()
    const code = withStyle(docx, 'SourceCode')[0] as Element
    expect(all(code, NS.w, 'br')).toHaveLength(1)
    expect(all(code, NS.w, 'tab')).toHaveLength(1)
    const quote = withStyle(docx, 'BlockText')[0] as Element
    expect(text(quote)).toStartWith('A harbour is a promise')
    expect(val(prop(quote, 'ind'), 'left')).toBe('720')
    const video = docx.paragraphs.find((p) => text(p).startsWith('Video:')) as Element
    expect(text(video)).toBe('Video: youtube.com/watch?v=dQw4w9WgXcQ&t=30s')
    expect(all(video, NS.w, 'hyperlink')).toHaveLength(1)
  })

  test('applies character formatting', () => {
    const run = (word: string) => all(docx.body, NS.w, 'r').find((r) => text(r) === word) as Element
    const props = (word: string) =>
      children(one(run(word), NS.w, 'rPr')).map(
        (el) => el.localName + (val(el) ? `=${val(el)}` : '')
      )
    expect(props('nobody')).toEqual(['i', 'iCs'])
    expect(props('eleven')).toEqual(['b', 'bCs'])
    expect(props('twice')).toEqual(['u=single'])
    expect(props('owed')).toEqual(['strike'])
    expect(props('MS-1904')).toEqual(['rStyle=InlineCode'])
    expect(props('2')).toEqual(['vertAlign=subscript'])
    expect(props('rd')).toEqual(['vertAlign=superscript'])
    expect(props('red ink')).toEqual(['shd=clear'])
  })

  test('sets document properties', () => {
    const core = docx.part('docProps/core.xml')
    expect(textOf(core.getElementsByTagNameNS(NS.dc, 'title')[0])).toBe(book.title)
    expect(textOf(core.getElementsByTagNameNS(NS.dc, 'creator')[0])).toBe(book.author)
    expect(textOf(core.getElementsByTagNameNS('http://purl.org/dc/terms/', 'modified')[0])).toBe(
      '2026-10-21T09:30:00Z'
    )
    const app = docx.part('docProps/app.xml')
    expect(textOf(app.getElementsByTagName('Words')[0])).toBe(String(countBookWords(book)))
  })
})

describe('DOCX without fetchImage', async () => {
  const docx = await open(book)

  test('shows placeholders for remote images but embeds data URLs', () => {
    expect(docx.paragraphs.map(text)).toContain('[Image: The harbour at dawn]')
    expect(docx.paragraphs.map(text)).toContain('[Image: Chart of the crossing]')
    expect(all(docx.body, NS.wp, 'inline')).toHaveLength(1)
    expect(Object.keys(docx.files).filter((name) => name.startsWith('word/media/'))).toEqual([
      'word/media/image1.png',
    ])
  })
})

describe('DOCX document format', async () => {
  const docx = await open(book, { format: 'document', fetchImage })
  const manuscript = await open(book, { fetchImage })

  test('keeps the same structure checks', () => {
    for (const path of REQUIRED_PARTS) expect(docx.files[path]).toBeDefined()
    for (const [path, doc] of docx.xml) {
      if (path.startsWith('word/') && path.endsWith('.xml'))
        expect(ooxmlOrderErrors(doc)).toEqual([])
    }
  })

  test('drops the manuscript conventions', () => {
    const texts = docx.paragraphs.map(text)
    expect(withStyle(docx, 'TitlePageInfo')).toHaveLength(0)
    expect(texts.some((line) => /about [\d,]+ words/.test(line))).toBe(false)
    expect(texts).not.toContain('END')
    expect(texts).not.toContain('#')
    expect(withStyle(docx, 'HorizontalRule')).toHaveLength(1)
    // One section: no title-page section break.
    expect(all(docx.body, NS.w, 'sectPr')).toHaveLength(1)
    expect(all(docx.body, NS.w, 'pgNumType')).toHaveLength(0)
    expect(text(one(docx.part('word/header1.xml'), NS.w, 'p'))).toBe('1')
    expect(text(one(manuscript.part('word/header1.xml'), NS.w, 'p'))).not.toBe('1')
  })

  test('opens with title, subtitle, author and date, then real heading styles', () => {
    const [title, subtitle, author, date] = docx.paragraphs
    expect(
      [title, subtitle, author, date].map((p) => [styleOf(p as Element), text(p as Element)])
    ).toEqual([
      ['Title', book.title],
      ['Subtitle', book.subtitle ?? ''],
      ['Author', book.author],
      ['Date', 'October 1, 2026'],
    ])
    const headings = docx.paragraphs
      .filter((p) => styleOf(p)?.startsWith('Heading'))
      .map((p) => [styleOf(p), text(p)])
    expect(headings).toEqual([
      ['Heading1', 'Part One: Arrival'],
      ['Heading2', 'The Harbour'],
      ['Heading4', 'The ledger'],
      ['Heading2', 'Letters'],
      ['Heading1', 'Part Two: Departure'],
      ['Heading2', 'The Crossing'],
      ['Heading4', 'Open water'],
    ])
    const breaks = docx.paragraphs.filter((p) => prop(p, 'pageBreakBefore')).map(text)
    expect(breaks).toEqual(['Letters', 'Part Two: Departure'])
    expect(withStyle(docx, 'Caption').map(text)).toEqual(withStyle(manuscript, 'Caption').map(text))
  })

  test('uses modern typography', () => {
    const defaults = one(docx.part('word/styles.xml'), NS.w, 'docDefaults')
    expect(one(defaults, NS.w, 'rFonts').getAttributeNS(NS.w, 'ascii')).toBe('Cambria')
    expect(val(one(defaults, NS.w, 'sz'))).toBe('22')
    expect(val(one(defaults, NS.w, 'spacing'), 'line')).toBe('276')
    const ms = one(manuscript.part('word/styles.xml'), NS.w, 'docDefaults')
    expect(one(ms, NS.w, 'rFonts').getAttributeNS(NS.w, 'ascii')).toBe('Times New Roman')
    expect(val(one(ms, NS.w, 'sz'))).toBe('24')
  })

  test('a one-chapter paper is not given a chapter heading', async () => {
    const paper = await open(
      {
        title: 'On Tides',
        author: 'R. Searcher',
        chapters: [
          {
            id: 'p',
            title: 'On Tides',
            doc: {
              type: 'doc',
              content: [
                {
                  type: 'heading',
                  attrs: { level: 1 },
                  content: [{ type: 'text', text: 'Introduction' }],
                },
                { type: 'paragraph', content: [{ type: 'text', text: 'Body.' }] },
              ],
            },
          },
        ],
      },
      { format: 'document', pageSize: 'a4' }
    )
    expect(paper.paragraphs.map((p) => [styleOf(p), text(p)])).toEqual([
      ['Title', 'On Tides'],
      ['Author', 'R. Searcher'],
      ['Heading1', 'Introduction'],
      ['FirstParagraph', 'Body.'],
    ])
    expect(val(one(paper.body, NS.w, 'pgSz'), 'w')).toBe('11906')
  })
})

describe('DOCX edge cases', () => {
  test('an empty book and unknown nodes still make a valid file', async () => {
    const empty = await open({ title: '', author: '', chapters: [] })
    expect(all(empty.body, NS.w, 'sectPr')).toHaveLength(2)
    const odd = await open({
      title: 'Odd',
      author: 'Someone',
      chapters: [
        {
          id: 'x',
          title: 'X',
          doc: {
            type: 'doc',
            content: [
              { type: 'mystery', content: [{ type: 'text', text: 'loose text' }] },
              { type: 'table', content: [] },
              {
                type: 'table',
                content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [] }] }],
              },
              {
                type: 'table',
                content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [] }] }],
              },
              { type: 'footnoteReference', attrs: { id: 'nowhere' } },
              { type: 'image', attrs: { src: 'javascript:alert(1)' } },
              { type: 'paragraph', content: [{ type: 'text', text: 'bell\u0007 ok' }] },
            ],
          },
        },
      ],
    })
    for (const [, doc] of odd.xml) expect(ooxmlOrderErrors(doc)).toEqual([])
    const texts = odd.paragraphs.map(text)
    expect(texts).toContain('loose text')
    expect(texts).toContain('[Image]')
    expect(texts).toContain('bell ok')
    // Adjacent tables are kept apart by a paragraph.
    const tables = all(odd.body, NS.w, 'tbl')
    expect(tables).toHaveLength(2)
    expect((tables[0]?.nextSibling as Element).localName).toBe('p')
  })
})
