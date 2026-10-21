import { sanitizeUrl } from '../sanitize'
import { groupChapters } from './book'
import { imageExtension, loadImages } from './images'
import type { ExportBook, ExportChapter, ExportImage, FetchImage } from './types'
import { renderXhtml } from './xhtml'
import { escapeXml, isoSeconds, randomUuid, w3cDate, walk, XML_HEADER } from './xml'
import { createZip, type ZipEntry } from './zip'

export type EpubOptions = {
  /** Embeds images under OEBPS/images/. Without it remote images stay remote. */
  fetchImage?: FetchImage
  /** dcterms:modified and the zip timestamps. Default: now. */
  modified?: Date
}

// EPUB 3.3 core media types; anything else would need a fallback chain.
const EPUB_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
])
// Already compressed: deflating them again only costs time.
const STORED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

const LANGUAGE_TAG = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/

type ChapterEntry = {
  kind: 'chapter'
  id: string
  file: string
  title: string
  chapter: ExportChapter
}
type PartEntry = { kind: 'part'; id: string; file: string; title: string; chapters: ChapterEntry[] }
type TocEntry = ChapterEntry | PartEntry

type ManifestItem = { id: string; href: string; mediaType: string; properties?: string[] }

const pad = (n: number, width: number) => String(n).padStart(width, '0')

/** Chapters, with each run of chapters that share a part nested under it. */
function tableOfContents(chapters: ExportChapter[]): TocEntry[] {
  let parts = 0
  return groupChapters(chapters).flatMap((group): TocEntry[] => {
    const entries = group.chapters.map(({ chapter, index }): ChapterEntry => {
      const number = pad(index + 1, 3)
      return {
        kind: 'chapter',
        id: `chapter-${number}`,
        file: `chapter-${number}.xhtml`,
        title: chapter.title.trim() || `Chapter ${index + 1}`,
        chapter,
      }
    })
    if (!group.part) return entries
    parts += 1
    const id = `part-${pad(parts, 2)}`
    return [{ kind: 'part', id, file: `${id}.xhtml`, title: group.part, chapters: entries }]
  })
}

function readingOrder(toc: TocEntry[]): (ChapterEntry | PartEntry)[] {
  return toc.flatMap((entry) => (entry.kind === 'part' ? [entry, ...entry.chapters] : [entry]))
}

function page(title: string, language: string, body: string, bodyType?: string): string {
  const lang = escapeXml(language)
  return `${XML_HEADER}<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
<title>${escapeXml(title)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body${bodyType ? ` epub:type="${bodyType}"` : ''}>
${body}
</body>
</html>
`
}

const CONTAINER_XML = `${XML_HEADER}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles>
<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
</rootfiles>
</container>
`

/**
 * Builds an EPUB 3.3 book (with an EPUB 2 NCX for older readers): cover,
 * title page, contents, an optional page per part, then one XHTML file per
 * chapter with its footnotes as pop-up asides.
 */
export async function buildEpub(book: ExportBook, options: EpubOptions = {}): Promise<Uint8Array> {
  const language = LANGUAGE_TAG.test(book.language?.trim() ?? '')
    ? (book.language ?? '').trim()
    : 'en'
  const identifier = book.identifier?.trim() || `urn:uuid:${randomUuid()}`
  const modified = options.modified ?? new Date()
  const title = book.title.trim() || 'Untitled'
  const author = book.author.trim()

  const toc = tableOfContents(book.chapters)
  const order = readingOrder(toc)
  const chapters = order.filter((entry): entry is ChapterEntry => entry.kind === 'chapter')

  // Images, in reading order so their file names are stable.
  const sources = new Set<string>()
  // Which file each block id lives in, so cross-chapter links can be rewritten.
  const idFile = new Map<string, string>()
  for (const entry of chapters) {
    walk(entry.chapter.doc, (node) => {
      if (node.type === 'image') {
        const src = sanitizeUrl(node.attrs?.src, { allowData: true })
        if (src) sources.add(src)
      }
      const id = node.attrs?.id
      if (typeof id === 'string' && id && !idFile.has(id)) idFile.set(id, entry.file)
    })
  }
  const loaded = await loadImages(sources, options.fetchImage)
  const embedded = new Map<string, ManifestItem & { image: ExportImage }>()
  for (const src of sources) {
    const image = loaded.get(src)
    if (!image || !EPUB_IMAGE_TYPES.has(image.mediaType)) continue
    const n = embedded.size + 1
    embedded.set(src, {
      id: `image-${n}`,
      href: `images/image-${n}.${imageExtension(image.mediaType)}`,
      mediaType: image.mediaType,
      image,
    })
  }
  // Unembedded web images stay remote; anything else (a relative path, an
  // unsupported data URL) would be a broken reference, so its alt text shows.
  const imageSrc = (src: string) =>
    embedded.get(src)?.href ?? (/^https?:\/\//i.test(src) ? src : null)

  const manifest: ManifestItem[] = [
    { id: 'nav', href: 'nav.xhtml', mediaType: 'application/xhtml+xml', properties: ['nav'] },
    { id: 'ncx', href: 'toc.ncx', mediaType: 'application/x-dtbncx+xml' },
    { id: 'style', href: 'style.css', mediaType: 'text/css' },
  ]
  const spine: string[] = []
  const files: ZipEntry[] = []
  const landmarks: string[] = []

  const cover = book.cover && EPUB_IMAGE_TYPES.has(book.cover.mediaType) ? book.cover : null
  if (cover) {
    const href = `images/cover.${imageExtension(cover.mediaType)}`
    manifest.push({
      id: 'cover-image',
      href,
      mediaType: cover.mediaType,
      properties: ['cover-image'],
    })
    manifest.push({ id: 'cover', href: 'cover.xhtml', mediaType: 'application/xhtml+xml' })
    spine.push('cover')
    landmarks.push('<li><a epub:type="cover" href="cover.xhtml">Cover</a></li>')
    files.push({
      path: `OEBPS/${href}`,
      data: cover.data,
      store: STORED_IMAGE_TYPES.has(cover.mediaType),
    })
    files.push({
      path: 'OEBPS/cover.xhtml',
      data: page(
        title,
        language,
        `<section epub:type="cover" class="cover">\n<img src="${href}" alt="${escapeXml(`Cover: ${title}`)}"/>\n</section>`,
        'cover'
      ),
    })
  }

  const titlePage = [
    `<h1 class="title">${escapeXml(title)}</h1>`,
    book.subtitle?.trim() ? `<p class="subtitle">${escapeXml(book.subtitle.trim())}</p>` : '',
    author ? `<p class="author">${escapeXml(author)}</p>` : '',
    book.publisher?.trim() ? `<p class="publisher">${escapeXml(book.publisher.trim())}</p>` : '',
  ].filter(Boolean)
  manifest.push({ id: 'titlepage', href: 'title.xhtml', mediaType: 'application/xhtml+xml' })
  spine.push('titlepage', 'nav')
  landmarks.push('<li><a epub:type="titlepage" href="title.xhtml">Title Page</a></li>')
  landmarks.push('<li><a epub:type="toc" href="nav.xhtml#toc">Contents</a></li>')
  files.push({
    path: 'OEBPS/title.xhtml',
    data: page(
      title,
      language,
      `<section epub:type="titlepage" class="titlepage">\n${titlePage.join('\n')}\n</section>`,
      'frontmatter'
    ),
  })

  const first = order[0]
  if (first) {
    landmarks.push(`<li><a epub:type="bodymatter" href="${first.file}">Start</a></li>`)
  }

  for (const entry of order) {
    if (entry.kind === 'part') {
      manifest.push({ id: entry.id, href: entry.file, mediaType: 'application/xhtml+xml' })
      spine.push(entry.id)
      files.push({
        path: `OEBPS/${entry.file}`,
        data: page(
          entry.title,
          language,
          `<section epub:type="part" role="doc-part" class="part">\n<h1 class="part-title">${escapeXml(entry.title)}</h1>\n</section>`,
          'bodymatter'
        ),
      })
      continue
    }
    const fragment = renderXhtml(entry.chapter.doc, {
      headingOffset: 1,
      imageSrc,
      fragmentHref: (href) => {
        const target = idFile.get(href.slice(1))
        return target && target !== entry.file ? `${target}${href}` : href
      },
      ids: new Set(),
    })
    const notes = fragment.notes
      ? `\n<section class="footnotes">\n${fragment.notes}\n</section>`
      : ''
    const properties = [fragment.math ? 'mathml' : '', fragment.remote ? 'remote-resources' : '']
    manifest.push({
      id: entry.id,
      href: entry.file,
      mediaType: 'application/xhtml+xml',
      properties: properties.filter(Boolean),
    })
    spine.push(entry.id)
    files.push({
      path: `OEBPS/${entry.file}`,
      data: page(
        entry.title,
        language,
        `<section epub:type="chapter" role="doc-chapter" class="chapter">\n<h1 class="chapter-title">${escapeXml(
          entry.title
        )}</h1>\n${fragment.body}${notes}\n</section>`,
        'bodymatter'
      ),
    })
  }

  for (const item of embedded.values()) {
    manifest.push({ id: item.id, href: item.href, mediaType: item.mediaType })
    files.push({
      path: `OEBPS/${item.href}`,
      data: item.image.data,
      store: STORED_IMAGE_TYPES.has(item.mediaType),
    })
  }

  // Contents: parts are list items with their chapters nested.
  const tocLink = (entry: TocEntry) => `<a href="${entry.file}">${escapeXml(entry.title)}</a>`
  const tocItems = toc.map((entry) =>
    entry.kind === 'part'
      ? `<li>${tocLink(entry)}\n<ol>\n${entry.chapters
          .map((chapter) => `<li>${tocLink(chapter)}</li>`)
          .join('\n')}\n</ol>\n</li>`
      : `<li>${tocLink(entry)}</li>`
  )
  // A nav list may not be empty.
  if (tocItems.length === 0) tocItems.push(`<li><a href="title.xhtml">${escapeXml(title)}</a></li>`)
  const nav = page(
    'Contents',
    language,
    `<nav epub:type="toc" role="doc-toc" id="toc">
<h1>Contents</h1>
<ol>
${tocItems.join('\n')}
</ol>
</nav>
<nav epub:type="landmarks" id="landmarks" hidden="">
<h2>Landmarks</h2>
<ol>
${landmarks.join('\n')}
</ol>
</nav>`,
    'frontmatter'
  )

  let playOrder = 0
  const navPoint = (entry: TocEntry, depth: string): string => {
    // Taken before the children: a part comes before its chapters in reading order.
    const order = ++playOrder
    const children =
      entry.kind === 'part'
        ? `\n${entry.chapters.map((chapter) => navPoint(chapter, `${depth}  `)).join('\n')}`
        : ''
    return `${depth}<navPoint id="navpoint-${order}" playOrder="${order}">
${depth}  <navLabel><text>${escapeXml(entry.title)}</text></navLabel>
${depth}  <content src="${entry.file}"/>${children}
${depth}</navPoint>`
  }
  const navPoints = toc.map((entry) => navPoint(entry, '    '))
  if (navPoints.length === 0) {
    navPoints.push(`    <navPoint id="navpoint-1" playOrder="1">
      <navLabel><text>${escapeXml(title)}</text></navLabel>
      <content src="title.xhtml"/>
    </navPoint>`)
  }
  const ncx = `${XML_HEADER}<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${escapeXml(language)}">
  <head>
    <meta name="dtb:uid" content="${escapeXml(identifier)}"/>
    <meta name="dtb:depth" content="${toc.some((entry) => entry.kind === 'part') ? 2 : 1}"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>${
    author ? `\n  <docAuthor><text>${escapeXml(author)}</text></docAuthor>` : ''
  }
  <navMap>
${navPoints.join('\n')}
  </navMap>
</ncx>
`

  const date = w3cDate(book.date)
  const metadata = [
    `<dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier>`,
    `<dc:title id="title">${escapeXml(title)}</dc:title>`,
    '<meta refines="#title" property="title-type">main</meta>',
    ...(book.subtitle?.trim()
      ? [
          `<dc:title id="subtitle">${escapeXml(book.subtitle.trim())}</dc:title>`,
          '<meta refines="#subtitle" property="title-type">subtitle</meta>',
        ]
      : []),
    ...(author
      ? [
          `<dc:creator id="creator">${escapeXml(author)}</dc:creator>`,
          '<meta refines="#creator" property="role" scheme="marc:relators">aut</meta>',
        ]
      : []),
    `<dc:language>${escapeXml(language)}</dc:language>`,
    book.publisher?.trim()
      ? `<dc:publisher>${escapeXml(book.publisher.trim())}</dc:publisher>`
      : '',
    date ? `<dc:date>${escapeXml(date)}</dc:date>` : '',
    book.description?.trim()
      ? `<dc:description>${escapeXml(book.description.trim())}</dc:description>`
      : '',
    `<meta property="dcterms:modified">${isoSeconds(modified)}</meta>`,
    // EPUB 2 readers find the cover this way.
    cover ? '<meta name="cover" content="cover-image"/>' : '',
  ].filter(Boolean)

  const opf = `${XML_HEADER}<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${escapeXml(language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
${metadata.map((line) => `    ${line}`).join('\n')}
  </metadata>
  <manifest>
${manifest
  .map(
    (item) =>
      `    <item id="${item.id}" href="${escapeXml(item.href)}" media-type="${item.mediaType}"${
        item.properties?.length ? ` properties="${item.properties.join(' ')}"` : ''
      }/>`
  )
  .join('\n')}
  </manifest>
  <spine toc="ncx">
${spine.map((idref) => `    <itemref idref="${idref}"/>`).join('\n')}
  </spine>
</package>
`

  return createZip(
    [
      { path: 'mimetype', data: 'application/epub+zip', store: true },
      { path: 'META-INF/container.xml', data: CONTAINER_XML },
      { path: 'OEBPS/content.opf', data: opf },
      { path: 'OEBPS/nav.xhtml', data: nav },
      { path: 'OEBPS/toc.ncx', data: ncx },
      { path: 'OEBPS/style.css', data: EPUB_CSS },
      ...files,
    ],
    { date: modified }
  )
}

/**
 * Book typography that leaves fonts, size and colours to the reader's
 * settings (so night themes work): indented paragraphs except after headings
 * and breaks, centred scene breaks, small pop-up-friendly footnotes.
 */
export const EPUB_CSS = `@charset "UTF-8";
@namespace epub "http://www.idpf.org/2007/ops";

body {
  font-family: Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif;
  line-height: 1.45;
  text-align: left;
  widows: 2;
  orphans: 2;
  -webkit-hyphens: auto;
  -epub-hyphens: auto;
  hyphens: auto;
}

p {
  margin: 0;
  text-indent: 1.5em;
}

/* No indent where a paragraph opens a section, or outside running text. */
h1 + p, h2 + p, h3 + p, h4 + p, h5 + p, h6 + p, hr + p,
blockquote p, li p, th p, td p, aside p, .callout-body p, figcaption, .caption,
section > p:first-child {
  text-indent: 0;
}

h1, h2, h3, h4, h5, h6 {
  font-weight: normal;
  line-height: 1.25;
  text-align: left;
  -webkit-hyphens: manual;
  -epub-hyphens: manual;
  hyphens: manual;
  page-break-after: avoid;
  break-after: avoid;
  page-break-inside: avoid;
  break-inside: avoid;
}

h1.chapter-title {
  font-size: 1.6em;
  text-align: center;
  margin: 3em 0 2em;
}

h2 { font-size: 1.3em; margin: 2em 0 0.75em; }
h3 { font-size: 1.15em; font-style: italic; margin: 1.75em 0 0.5em; }
h4, h5, h6 { font-size: 1em; font-weight: bold; margin: 1.5em 0 0.5em; }

.titlepage {
  text-align: center;
  margin-top: 25%;
}
.titlepage p { text-indent: 0; }
.titlepage .title { font-size: 2em; text-align: center; margin: 0 0 0.5em; }
.titlepage .subtitle { font-size: 1.2em; font-style: italic; margin-bottom: 2em; }
.titlepage .author { font-size: 1.15em; font-variant: small-caps; letter-spacing: 0.05em; margin-top: 3em; }
.titlepage .publisher { font-size: 0.9em; margin-top: 6em; }

.part { text-align: center; margin-top: 30%; }
.part-title { font-size: 1.8em; text-align: center; }

.cover { margin: 0; padding: 0; text-align: center; }
.cover img { max-width: 100%; max-height: 100%; }

/* Scene break: a centred asterism instead of a rule. */
hr {
  border: 0;
  height: auto;
  margin: 1.25em 0;
  text-align: center;
  overflow: visible;
  page-break-after: avoid;
  break-after: avoid;
}
hr::after {
  content: "*\\2003*\\2003*";
  display: block;
}

blockquote { margin: 1em 1.5em; }
blockquote p + p { text-indent: 1.5em; }

ul, ol { margin: 0.75em 0; padding-left: 1.75em; }
li { margin: 0.2em 0; }
ul[data-type="taskList"] { list-style: none; padding-left: 0.25em; }
li[data-type="taskItem"] > label { float: left; margin-right: 0.5em; }
li[data-type="taskItem"] > div { overflow: hidden; }

pre {
  font-family: Menlo, Consolas, "DejaVu Sans Mono", "Courier New", monospace;
  font-size: 0.8em;
  line-height: 1.35;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 1em 0;
  padding-left: 1em;
  border-left: 2px solid #999;
  -webkit-hyphens: none;
  hyphens: none;
}
code { font-family: Menlo, Consolas, "DejaVu Sans Mono", "Courier New", monospace; font-size: 0.875em; }
pre code { font-size: 1em; }

sup, sub { font-size: 0.75em; line-height: 0; }

sup.noteref { font-size: 0.7em; vertical-align: super; line-height: 0; }
a[epub|type~="noteref"] { text-decoration: none; }
.footnotes {
  margin-top: 2.5em;
  padding-top: 0.75em;
  border-top: 1px solid #999;
  font-size: 0.85em;
}
aside.footnote { margin: 0 0 0.6em; }
aside.footnote p { margin: 0 0 0.3em; }
.note-number { text-decoration: none; }

img { max-width: 100%; height: auto; }
div.image { margin: 1em 0; text-align: center; }
figure {
  margin: 1.5em 0;
  text-align: center;
  page-break-inside: avoid;
  break-inside: avoid;
}
figcaption, .caption { font-size: 0.9em; margin-top: 0.5em; text-align: center; }
.figure-label { font-weight: bold; }
.image-alt { font-style: italic; }

.table-wrap { margin: 1em 0; overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 0.9em; text-align: left; }
th, td { border: 1px solid #999; padding: 0.3em 0.5em; vertical-align: top; }
th { font-weight: bold; }
th p, td p { margin: 0; }

.callout { margin: 1em 0; padding: 0.5em 0.75em; border: 1px solid #999; }
.callout-icon { float: left; margin-right: 0.5em; }
.callout-body { overflow: hidden; }

.equation { margin: 1em 0; text-align: center; }
.equation-label { float: right; margin-left: 1em; }
.math-source { white-space: pre-wrap; }

.video-link { margin: 1em 0; text-align: center; text-indent: 0; }

mark { background-color: #fef08a; color: inherit; }

nav ol { list-style: none; padding-left: 0; }
nav ol ol { padding-left: 1.5em; }
nav li { margin: 0.3em 0; }
`
