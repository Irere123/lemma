import { describe, expect, test } from 'bun:test'
import type { Document, Element } from '@xmldom/xmldom'

import { buildEpub, type ExportBook } from '../../src/export'
import { book, cover, fetchImage, HARBOUR_SRC, MAP_SRC, MODIFIED } from './fixture'
import {
  all,
  attr,
  children,
  NS,
  one,
  parseXml,
  rawEntries,
  resolvePath,
  textOf,
  unzip,
  utf8,
} from './helpers'

type Epub = {
  zip: Uint8Array
  files: Record<string, Uint8Array>
  xml: Map<string, Document>
  opfPath: string
  opf: Document
  manifest: Map<
    string,
    { id: string; href: string; path: string; type: string; properties: string[] }
  >
  spine: string[]
}

async function open(input: ExportBook, options?: Parameters<typeof buildEpub>[1]): Promise<Epub> {
  const zip = await buildEpub(input, { modified: MODIFIED, ...options })
  const files = unzip(zip)
  const xml = new Map<string, Document>()
  for (const [path, data] of Object.entries(files)) {
    if (/\.(xhtml|opf|ncx|xml)$/.test(path)) xml.set(path, parseXml(utf8(data), path))
  }
  const container = xml.get('META-INF/container.xml')
  if (!container) throw new Error('no container')
  const opfPath = one(container, NS.container, 'rootfile').getAttribute('full-path') ?? ''
  const opf = xml.get(opfPath)
  if (!opf) throw new Error('no OPF')
  const manifest = new Map(
    all(opf, NS.opf, 'item').map((item) => {
      const href = item.getAttribute('href') ?? ''
      return [
        item.getAttribute('id') ?? '',
        {
          id: item.getAttribute('id') ?? '',
          href,
          path: resolvePath(opfPath, href),
          type: item.getAttribute('media-type') ?? '',
          properties: (item.getAttribute('properties') ?? '').split(/\s+/).filter(Boolean),
        },
      ]
    })
  )
  const spine = all(opf, NS.opf, 'itemref').map((ref) => ref.getAttribute('idref') ?? '')
  return { zip, files, xml, opfPath, opf, manifest, spine }
}

const chapterItems = (epub: Epub) =>
  epub.spine.map((id) => epub.manifest.get(id)).filter((item) => item?.href.startsWith('chapter-'))

const doc = (epub: Epub, href: string) => {
  const found = epub.xml.get(resolvePath(epub.opfPath, href))
  if (!found) throw new Error(`no ${href}`)
  return found
}

const byEpubType = (root: Document | Element, localName: string, type: string) =>
  all(root, NS.xhtml, localName).filter((el) =>
    (attr(el, NS.epub, 'type') ?? '').split(/\s+/).includes(type)
  )

describe('EPUB package', async () => {
  const epub = await open({ ...book, cover }, { fetchImage })

  test('every XML and XHTML file parses as strict XML', () => {
    const names = Object.keys(epub.files).filter((name) => /\.(xhtml|opf|ncx|xml)$/.test(name))
    expect(names.length).toBeGreaterThanOrEqual(10)
    expect(epub.xml.size).toBe(names.length)
  })

  test('starts with a stored mimetype', () => {
    const [first] = rawEntries(epub.zip)
    expect(first?.name).toBe('mimetype')
    expect(first?.method).toBe(0)
    expect(utf8(epub.files.mimetype)).toBe('application/epub+zip')
  })

  test('container points at the package document', () => {
    expect(epub.opfPath).toBe('OEBPS/content.opf')
    expect(one(epub.opf, NS.opf, 'package').getAttribute('version')).toBe('3.0')
  })

  test('has the required and optional metadata', () => {
    const pkg = one(epub.opf, NS.opf, 'package')
    const identifier = all(epub.opf, NS.dc, 'identifier').find(
      (el) => el.getAttribute('id') === pkg.getAttribute('unique-identifier')
    )
    expect(textOf(identifier)).toBe(book.identifier ?? '')
    expect(all(epub.opf, NS.dc, 'title').map(textOf)).toEqual([book.title, book.subtitle ?? ''])
    expect(textOf(one(epub.opf, NS.dc, 'creator'))).toBe(book.author)
    expect(textOf(one(epub.opf, NS.dc, 'language'))).toBe('en')
    expect(textOf(one(epub.opf, NS.dc, 'publisher'))).toBe('Lemma Press')
    expect(textOf(one(epub.opf, NS.dc, 'date'))).toBe('2026-10-01')
    expect(textOf(one(epub.opf, NS.dc, 'description'))).toContain('missing crate')
    const meta = all(epub.opf, NS.opf, 'meta')
    const modified = meta.find((el) => el.getAttribute('property') === 'dcterms:modified')
    expect(textOf(modified)).toBe('2026-10-21T09:30:00Z')
    expect(meta.find((el) => el.getAttribute('name') === 'cover')?.getAttribute('content')).toBe(
      'cover-image'
    )
    expect(epub.manifest.get('cover-image')?.properties).toEqual(['cover-image'])
  })

  test('manifest and archive agree', () => {
    for (const item of epub.manifest.values()) expect(epub.files[item.path]).toBeDefined()
    const listed = new Set([...epub.manifest.values()].map((item) => item.path))
    const unlisted = Object.keys(epub.files).filter(
      (name) => name !== 'mimetype' && !name.startsWith('META-INF/') && name !== epub.opfPath
    )
    expect(unlisted.filter((name) => !listed.has(name))).toEqual([])
    expect(
      [...epub.manifest.values()].filter((item) => item.properties.includes('nav'))
    ).toHaveLength(1)
    for (const id of epub.spine) expect(epub.manifest.has(id)).toBe(true)
  })

  test('spine follows the book: cover, title page, contents, then parts and chapters in order', () => {
    expect(epub.spine.slice(0, 3)).toEqual(['cover', 'titlepage', 'nav'])
    const titles = chapterItems(epub).map((item) =>
      textOf(one(doc(epub, item?.href ?? ''), NS.xhtml, 'h1'))
    )
    expect(titles).toEqual(book.chapters.map((chapter) => chapter.title))
    expect(epub.spine.slice(3)).toEqual([
      'part-01',
      'chapter-001',
      'chapter-002',
      'part-02',
      'chapter-003',
    ])
  })

  test('nav lists every chapter, nested under its part, plus landmarks', () => {
    const nav = doc(epub, 'nav.xhtml')
    const toc = byEpubType(nav, 'nav', 'toc')[0]
    if (!toc) throw new Error('no toc nav')
    const top = children(one(toc, NS.xhtml, 'ol'), NS.xhtml, 'li')
    const outline = top.map((li) => ({
      part: textOf(children(li, NS.xhtml, 'a')[0]),
      chapters: all(li, NS.xhtml, 'ol').flatMap((ol) =>
        children(ol, NS.xhtml, 'li').map((child) => textOf(child))
      ),
    }))
    expect(outline).toEqual([
      { part: 'Part One: Arrival', chapters: ['The Harbour', 'Letters'] },
      { part: 'Part Two: Departure', chapters: ['The Crossing'] },
    ])
    const landmarks = byEpubType(nav, 'nav', 'landmarks')[0]
    const types = all(landmarks as Element, NS.xhtml, 'a').map((a) => attr(a, NS.epub, 'type'))
    expect(types).toEqual(['cover', 'titlepage', 'toc', 'bodymatter'])
  })

  test('the NCX mirrors the contents for EPUB 2 readers', () => {
    const ncx = epub.xml.get('OEBPS/toc.ncx')
    if (!ncx) throw new Error('no ncx')
    expect(one(epub.opf, NS.opf, 'spine').getAttribute('toc')).toBe('ncx')
    const points = all(ncx, NS.ncx, 'navPoint')
    expect(points.map((point) => point.getAttribute('playOrder'))).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ])
    expect(points.map((point) => textOf(one(point, NS.ncx, 'text')))).toEqual([
      'Part One: Arrival',
      'The Harbour',
      'Letters',
      'Part Two: Departure',
      'The Crossing',
    ])
    const uid = all(ncx, NS.ncx, 'meta').find((meta) => meta.getAttribute('name') === 'dtb:uid')
    expect(uid?.getAttribute('content')).toBe(book.identifier ?? '')
  })

  test('noterefs and footnote asides resolve to each other within the chapter', () => {
    let notes = 0
    for (const item of chapterItems(epub)) {
      const chapter = doc(epub, item?.href ?? '')
      const ids = new Set(all(chapter, NS.xhtml, '*').map((el) => el.getAttribute('id')))
      for (const ref of byEpubType(chapter, 'a', 'noteref')) {
        const href = ref.getAttribute('href') ?? ''
        expect(href.startsWith('#')).toBe(true)
        const aside = all(chapter, NS.xhtml, 'aside').find(
          (el) => el.getAttribute('id') === href.slice(1)
        )
        expect(attr(aside, NS.epub, 'type')).toBe('footnote')
        notes += 1
      }
      for (const aside of byEpubType(chapter, 'aside', 'footnote')) {
        const back = all(aside, NS.xhtml, 'a')[0]?.getAttribute('href') ?? ''
        expect(ids.has(back.slice(1))).toBe(true)
      }
    }
    // One reference in chapter one, two to the same note in chapter two.
    expect(notes).toBe(3)
    const two = doc(epub, 'chapter-002.xhtml')
    expect(byEpubType(two, 'aside', 'footnote')).toHaveLength(1)
    expect(
      all(two, NS.xhtml, 'sup')
        .filter((sup) => sup.getAttribute('class') === 'noteref')
        .map(textOf)
    ).toEqual(['1', '1'])
  })

  test('every link and image inside the book resolves; ids are unique per file', () => {
    for (const [path, file] of epub.xml) {
      if (!path.endsWith('.xhtml')) continue
      const ids = all(file, NS.xhtml, '*')
        .map((el) => el.getAttribute('id'))
        .filter(Boolean)
      expect(new Set(ids).size).toBe(ids.length)
      const refs = [
        ...all(file, NS.xhtml, 'a').map((a) => a.getAttribute('href') ?? ''),
        ...all(file, NS.xhtml, 'img').map((img) => img.getAttribute('src') ?? ''),
        ...all(file, NS.xhtml, 'link').map((link) => link.getAttribute('href') ?? ''),
      ]
      for (const ref of refs) {
        if (/^(https?|mailto):/.test(ref)) continue
        const [target = '', fragment] = ref.split('#')
        const targetPath = target ? resolvePath(path, target) : path
        expect(epub.files[targetPath]).toBeDefined()
        if (fragment) {
          const targetDoc = epub.xml.get(targetPath)
          const found = all(targetDoc as Document, NS.xhtml, '*').some(
            (el) => el.getAttribute('id') === fragment
          )
          expect(found).toBe(true)
        }
      }
    }
  })

  test('a link to a block in another chapter points at that chapter file', () => {
    const two = doc(epub, 'chapter-002.xhtml')
    const link = all(two, NS.xhtml, 'a').find((a) => textOf(a) === 'the ledger')
    expect(link?.getAttribute('href')).toBe('chapter-001.xhtml#ledgerheading')
  })

  test('chapter titles are the only h1; document headings move down a level', () => {
    const one_ = doc(epub, 'chapter-001.xhtml')
    expect(all(one_, NS.xhtml, 'h1').map(textOf)).toEqual(['The Harbour'])
    expect(all(one_, NS.xhtml, 'h3').map(textOf)).toEqual(['The ledger'])
    expect(all(one_, NS.xhtml, 'hr')).toHaveLength(1)
  })

  test('embeds fetched images under OEBPS/images and rewrites their src', () => {
    const images = [...epub.manifest.values()].filter((item) =>
      item.href.startsWith('images/image-')
    )
    // Harbour, map (sniffed as PNG despite .jpg and image/jpeg) and the data-URL seal.
    expect(images.map((item) => [item.href, item.type])).toEqual([
      ['images/image-1.png', 'image/png'],
      ['images/image-2.png', 'image/png'],
      ['images/image-3.png', 'image/png'],
    ])
    const srcs = chapterItems(epub).flatMap((item) =>
      all(doc(epub, item?.href ?? ''), NS.xhtml, 'img').map((img) => img.getAttribute('src'))
    )
    expect(srcs).toEqual(['images/image-1.png', 'images/image-2.png', 'images/image-3.png'])
    expect(epub.xml.get('OEBPS/chapter-001.xhtml')).toBeDefined()
    for (const item of chapterItems(epub))
      expect(item?.properties).not.toContain('remote-resources')
  })

  test('renders math as MathML and declares it', () => {
    const withMath = chapterItems(epub).filter(
      (item) => all(doc(epub, item?.href ?? ''), NS.mathml, 'math').length > 0
    )
    expect(withMath.map((item) => item?.id)).toEqual(['chapter-001', 'chapter-002'])
    for (const item of chapterItems(epub)) {
      const hasMath = withMath.includes(item)
      expect(item?.properties.includes('mathml')).toBe(hasMath)
    }
    const equation = all(doc(epub, 'chapter-002.xhtml'), NS.xhtml, 'div').find(
      (div) => div.getAttribute('class') === 'equation'
    )
    expect(textOf(equation)).toContain('(1)')
  })

  test('figures carry their numbered captions', () => {
    const captions = chapterItems(epub).flatMap((item) =>
      all(doc(epub, item?.href ?? ''), NS.xhtml, 'figcaption').map(textOf)
    )
    expect(captions).toEqual([
      'Figure 1. The harbour at dawn, from the old lighthouse',
      'Table 1. Winds on the crossing',
    ])
  })

  test('has a title page and a cover page', () => {
    const title = doc(epub, 'title.xhtml')
    expect(textOf(one(title, NS.xhtml, 'h1'))).toBe(book.title)
    expect(textOf(title.documentElement)).toContain(book.author)
    const coverPage = doc(epub, 'cover.xhtml')
    expect(one(coverPage, NS.xhtml, 'img').getAttribute('src')).toBe('images/cover.png')
    expect(epub.files['OEBPS/images/cover.png']).toEqual(cover.data)
  })
})

describe('EPUB without fetchImage', async () => {
  const epub = await open(book)

  test('keeps remote images remote and declares remote-resources', () => {
    const one_ = chapterItems(epub)[0]
    expect(one_?.properties).toContain('remote-resources')
    const srcs = all(doc(epub, 'chapter-001.xhtml'), NS.xhtml, 'img').map((img) =>
      img.getAttribute('src')
    )
    expect(srcs).toEqual([HARBOUR_SRC])
    const three = all(doc(epub, 'chapter-003.xhtml'), NS.xhtml, 'img').map((img) =>
      img.getAttribute('src')
    )
    // The data-URL seal is still embedded.
    expect(three).toEqual([MAP_SRC, 'images/image-1.png'])
    expect(chapterItems(epub)[1]?.properties).not.toContain('remote-resources')
    expect(epub.manifest.has('cover-image')).toBe(false)
    expect(epub.spine[0]).toBe('titlepage')
  })
})

describe('EPUB edge cases', () => {
  test('a book without chapters, parts or metadata is still a valid package', async () => {
    const epub = await open({ title: '', author: '', chapters: [] })
    expect(textOf(one(epub.opf, NS.dc, 'title'))).toBe('Untitled')
    expect(all(epub.opf, NS.dc, 'creator')).toHaveLength(0)
    expect(textOf(one(epub.opf, NS.dc, 'identifier'))).toMatch(
      /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
    const nav = doc(epub, 'nav.xhtml')
    expect(all(byEpubType(nav, 'nav', 'toc')[0] as Element, NS.xhtml, 'li')).toHaveLength(1)
  })

  test('chapters outside parts stay top-level, and unknown nodes never throw', async () => {
    const epub = await open({
      title: 'Loose',
      author: 'A. Writer',
      language: 'fr-CA',
      chapters: [
        {
          id: 'a',
          title: '',
          doc: { type: 'doc', content: [{ type: 'mystery', attrs: { x: 1 } }] },
        },
        {
          id: 'b',
          title: 'Two & <Three>',
          part: 'Middle',
          doc: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
          },
        },
        { id: 'c', title: 'Four', doc: { type: 'doc', content: [] } },
      ],
    })
    expect(epub.spine.slice(2)).toEqual(['chapter-001', 'part-01', 'chapter-002', 'chapter-003'])
    expect(textOf(one(doc(epub, 'chapter-001.xhtml'), NS.xhtml, 'h1'))).toBe('Chapter 1')
    expect(textOf(one(doc(epub, 'chapter-002.xhtml'), NS.xhtml, 'h1'))).toBe('Two & <Three>')
    expect(doc(epub, 'chapter-002.xhtml').documentElement?.getAttribute('xml:lang')).toBe('fr-CA')
  })
})
