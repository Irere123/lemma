import { DOMParser, type Document, type Element, type Node } from '@xmldom/xmldom'
import { unzipSync, zlibSync } from 'fflate'

import { crc32 } from '../../src/export/zip'

export const NS = {
  xhtml: 'http://www.w3.org/1999/xhtml',
  epub: 'http://www.idpf.org/2007/ops',
  opf: 'http://www.idpf.org/2007/opf',
  dc: 'http://purl.org/dc/elements/1.1/',
  ncx: 'http://www.daisy.org/z3986/2005/ncx/',
  container: 'urn:oasis:names:tc:opendocument:xmlns:container',
  mathml: 'http://www.w3.org/1998/Math/MathML',
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  pr: 'http://schemas.openxmlformats.org/package/2006/relationships',
  ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
}

const decoder = new TextDecoder('utf-8', { fatal: true })

export const utf8 = (bytes: Uint8Array | undefined) => {
  if (!bytes) throw new Error('missing file')
  return decoder.decode(bytes)
}

export function unzip(bytes: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(bytes)
}

export type RawEntry = {
  name: string
  method: number
  flags: number
  crc: number
  compressedSize: number
  size: number
  extraLength: number
  dataOffset: number
}

/** Walks the local file headers in order (fflate hides order and compression method). */
export function rawEntries(zip: Uint8Array): RawEntry[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const entries: RawEntry[] = []
  let at = 0
  while (at + 30 <= zip.length && view.getUint32(at, true) === 0x04034b50) {
    const nameLength = view.getUint16(at + 26, true)
    const extraLength = view.getUint16(at + 28, true)
    const compressedSize = view.getUint32(at + 18, true)
    const entry: RawEntry = {
      flags: view.getUint16(at + 6, true),
      method: view.getUint16(at + 8, true),
      crc: view.getUint32(at + 14, true),
      compressedSize,
      size: view.getUint32(at + 22, true),
      name: new TextDecoder().decode(zip.subarray(at + 30, at + 30 + nameLength)),
      extraLength,
      dataOffset: at + 30 + nameLength + extraLength,
    }
    entries.push(entry)
    at = entry.dataOffset + compressedSize
  }
  return entries
}

export { crc32 }

/**
 * Parses as strict XML: any warning or error fails, and every prefixed
 * element or attribute must have its namespace declared (xmldom alone lets
 * an unbound prefix through).
 */
export function parseXml(source: string, name = 'document'): Document {
  const parser = new DOMParser({
    onError: (level, message) => {
      throw new Error(`${name}: XML ${level}: ${message}`)
    },
  })
  const doc = parser.parseFromString(source, 'application/xml')
  const check = (node: Node) => {
    if (node.nodeType === 1) {
      const element = node as Element
      if (element.prefix && !element.namespaceURI) {
        throw new Error(`${name}: unbound prefix on <${element.tagName}>`)
      }
      for (let i = 0; i < element.attributes.length; i++) {
        const attribute = element.attributes.item(i)
        if (!attribute || attribute.prefix === 'xmlns' || attribute.name === 'xmlns') continue
        if (attribute.prefix && attribute.prefix !== 'xml' && !attribute.namespaceURI) {
          throw new Error(`${name}: unbound prefix on attribute ${attribute.name}`)
        }
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling) check(child)
  }
  check(doc)
  return doc
}

export function all(root: Document | Element, ns: string, localName: string): Element[] {
  return Array.from(root.getElementsByTagNameNS(ns, localName))
}

export function one(root: Document | Element, ns: string, localName: string): Element {
  const found = all(root, ns, localName)[0]
  if (!found) throw new Error(`no ${localName}`)
  return found
}

export function children(element: Element, ns?: string, localName?: string): Element[] {
  const out: Element[] = []
  for (let child = element.firstChild; child; child = child.nextSibling) {
    if (child.nodeType !== 1) continue
    const el = child as Element
    if (ns && el.namespaceURI !== ns) continue
    if (localName && el.localName !== localName) continue
    out.push(el)
  }
  return out
}

export const textOf = (node: Node | null | undefined): string => node?.textContent ?? ''

export function attr(element: Element | undefined, ns: string | null, name: string): string | null {
  if (!element) return null
  return ns ? element.getAttributeNS(ns, name) : element.getAttribute(name)
}

/** Resolves `href` against a file path inside the archive. */
export function resolvePath(from: string, href: string): string {
  const parts = from.split('/').slice(0, -1)
  for (const segment of href.split('/')) {
    if (segment === '..') parts.pop()
    else if (segment !== '.') parts.push(segment)
  }
  return parts.join('/')
}

// The ECMA-376 sequence of each property element we emit. Word refuses a file
// whose children are out of this order, so the tests check every part.
const ORDER: Record<string, string[]> = {
  pPr: [
    'pStyle',
    'keepNext',
    'keepLines',
    'pageBreakBefore',
    'framePr',
    'widowControl',
    'numPr',
    'suppressLineNumbers',
    'pBdr',
    'shd',
    'tabs',
    'suppressAutoHyphens',
    'kinsoku',
    'wordWrap',
    'overflowPunct',
    'topLinePunct',
    'autoSpaceDE',
    'autoSpaceDN',
    'bidi',
    'adjustRightInd',
    'snapToGrid',
    'spacing',
    'ind',
    'contextualSpacing',
    'mirrorIndents',
    'suppressOverlap',
    'jc',
    'textDirection',
    'textAlignment',
    'textboxTightWrap',
    'outlineLvl',
    'divId',
    'cnfStyle',
    'rPr',
    'sectPr',
    'pPrChange',
  ],
  rPr: [
    'rStyle',
    'rFonts',
    'b',
    'bCs',
    'i',
    'iCs',
    'caps',
    'smallCaps',
    'strike',
    'dstrike',
    'outline',
    'shadow',
    'emboss',
    'imprint',
    'noProof',
    'snapToGrid',
    'vanish',
    'webHidden',
    'color',
    'spacing',
    'w',
    'kern',
    'position',
    'sz',
    'szCs',
    'highlight',
    'u',
    'effect',
    'bdr',
    'shd',
    'fitText',
    'vertAlign',
    'rtl',
    'cs',
    'em',
    'lang',
    'eastAsianLayout',
    'specVanish',
    'oMath',
  ],
  sectPr: [
    'headerReference|footerReference',
    'footnotePr',
    'endnotePr',
    'type',
    'pgSz',
    'pgMar',
    'paperSrc',
    'pgBorders',
    'lnNumType',
    'pgNumType',
    'cols',
    'formProt',
    'vAlign',
    'noEndnote',
    'titlePg',
    'textDirection',
    'bidi',
    'rtlGutter',
    'docGrid',
    'printerSettings',
  ],
  tblPr: [
    'tblStyle',
    'tblpPr',
    'tblOverlap',
    'bidiVisual',
    'tblStyleRowBandSize',
    'tblStyleColBandSize',
    'tblW',
    'jc',
    'tblCellSpacing',
    'tblInd',
    'tblBorders',
    'shd',
    'tblLayout',
    'tblCellMar',
    'tblLook',
    'tblCaption',
    'tblDescription',
  ],
  tcPr: [
    'cnfStyle',
    'tcW',
    'gridSpan',
    'hMerge',
    'vMerge',
    'tcBorders',
    'shd',
    'noWrap',
    'tcMar',
    'textDirection',
    'tcFitText',
    'vAlign',
    'hideMark',
  ],
  tbl: ['tblPr', 'tblGrid', 'tr|bookmarkStart|bookmarkEnd'],
  tr: ['tblPrEx', 'trPr', 'tc'],
  tc: ['tcPr', 'p|tbl|bookmarkStart|bookmarkEnd'],
  p: ['pPr', '*'],
  r: ['rPr', '*'],
  pBdr: ['top', 'left', 'bottom', 'right', 'between', 'bar'],
  tblBorders: ['top', 'left|start', 'bottom', 'right|end', 'insideH', 'insideV'],
  tblCellMar: ['top', 'left|start', 'bottom', 'right|end'],
  numPr: ['ilvl', 'numId'],
  lvl: [
    'start',
    'numFmt',
    'lvlRestart',
    'pStyle',
    'isLgl',
    'suff',
    'lvlText',
    'lvlPicBulletId',
    'legacy',
    'lvlJc',
    'pPr',
    'rPr',
  ],
  abstractNum: ['nsid', 'multiLevelType', 'tmpl', 'name', 'styleLink', 'numStyleLink', 'lvl'],
  numbering: ['numPicBullet', 'abstractNum', 'num', 'numIdMacAtCleanup'],
  style: [
    'name',
    'aliases',
    'basedOn',
    'next',
    'link',
    'autoRedefine',
    'hidden',
    'uiPriority',
    'semiHidden',
    'unhideWhenUsed',
    'qFormat',
    'locked',
    'personal',
    'personalCompose',
    'personalReply',
    'rsid',
    'pPr',
    'rPr',
    'tblPr',
    'trPr',
    'tcPr',
    'tblStylePr',
  ],
  styles: ['docDefaults', 'latentStyles', 'style'],
  docDefaults: ['rPrDefault', 'pPrDefault'],
  settings: [
    'writeProtection',
    'view',
    'zoom',
    'removePersonalInformation',
    'removeDateAndTime',
    'doNotDisplayPageBoundaries',
    'displayBackgroundShape',
    'printPostScriptOverText',
    'printFractionalCharacterWidth',
    'printFormsData',
    'embedTrueTypeFonts',
    'embedSystemFonts',
    'saveSubsetFonts',
    'saveFormsData',
    'mirrorMargins',
    'alignBordersAndEdges',
    'bordersDoNotSurroundHeader',
    'bordersDoNotSurroundFooter',
    'gutterAtTop',
    'hideSpellingErrors',
    'hideGrammaticalErrors',
    'activeWritingStyle',
    'proofState',
    'formsDesign',
    'attachedTemplate',
    'linkStyles',
    'stylePaneFormatFilter',
    'stylePaneSortMethod',
    'documentType',
    'mailMerge',
    'revisionView',
    'trackRevisions',
    'doNotTrackMoves',
    'doNotTrackFormatting',
    'documentProtection',
    'autoFormatOverride',
    'styleLockTheme',
    'styleLockQFSet',
    'defaultTabStop',
    'autoHyphenation',
    'consecutiveHyphenLimit',
    'hyphenationZone',
    'doNotHyphenateCaps',
    'showEnvelope',
    'summaryLength',
    'clickAndTypeStyle',
    'defaultTableStyle',
    'evenAndOddHeaders',
    'bookFoldRevPrinting',
    'bookFoldPrinting',
    'bookFoldPrintingSheets',
    'drawingGridHorizontalSpacing',
    'drawingGridVerticalSpacing',
    'displayHorizontalDrawingGridEvery',
    'displayVerticalDrawingGridEvery',
    'doNotUseMarginsForDrawingGridOrigin',
    'drawingGridHorizontalOrigin',
    'drawingGridVerticalOrigin',
    'doNotShadeFormData',
    'noPunctuationKerning',
    'characterSpacingControl',
    'printTwoOnOne',
    'strictFirstAndLastChars',
    'noLineBreaksAfter',
    'noLineBreaksBefore',
    'savePreviewPicture',
    'doNotValidateAgainstSchema',
    'saveInvalidXml',
    'ignoreMixedContent',
    'alwaysShowPlaceholderText',
    'doNotDemarcateInvalidXml',
    'saveXmlDataOnly',
    'useXSLTWhenSaving',
    'saveThroughXslt',
    'showXMLTags',
    'alwaysMergeEmptyNamespace',
    'updateFields',
    'hdrShapeDefaults',
    'footnotePr',
    'endnotePr',
    'compat',
    'docVars',
    'rsids',
    'mathPr',
    'attachedSchema',
    'themeFontLang',
    'clrSchemeMapping',
    'doNotIncludeSubdocsInStats',
    'doNotAutoCompressPictures',
    'forceUpgrade',
    'captions',
    'readModeInkLockDown',
    'smartTagType',
    'schemaLibrary',
    'shapeDefaults',
    'doNotEmbedSmartTags',
    'decimalSymbol',
    'listSeparator',
  ],
}

// Elements that may appear only once among their parent's properties.
const ONCE = new Set(['pPr', 'rPr', 'sectPr', 'tblPr', 'tcPr', 'numPr', 'pBdr', 'tabs'])

/** Every WordprocessingML element's children in schema order; returns the violations. */
export function ooxmlOrderErrors(doc: Document): string[] {
  const errors: string[] = []
  const visit = (element: Element) => {
    const name = element.localName ?? ''
    const order: string[] | undefined = element.namespaceURI === NS.w ? ORDER[name] : undefined
    if (order) {
      let last = -1
      const seen = new Set<string>()
      for (const child of children(element)) {
        if (child.namespaceURI !== NS.w) continue
        const childName = child.localName ?? ''
        const rank = order.findIndex(
          (entry) => entry === '*' || entry.split('|').includes(childName)
        )
        if (rank === -1) {
          errors.push(`<w:${name}> has unexpected child <w:${childName}>`)
          continue
        }
        if (rank < last) errors.push(`<w:${childName}> out of order in <w:${name}>`)
        if (ONCE.has(childName) && seen.has(childName)) {
          errors.push(`<w:${childName}> repeated in <w:${name}>`)
        }
        seen.add(childName)
        last = Math.max(last, rank)
      }
    }
    for (const child of children(element)) visit(child)
  }
  if (doc.documentElement) visit(doc.documentElement)
  return errors
}

/** A solid-colour RGB PNG, valid enough for Word and Apple Books to display. */
export function makePng(width: number, height: number, rgb: [number, number, number]): Uint8Array {
  const raw = new Uint8Array(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3)
    for (let x = 0; x < width; x++) raw.set(rgb, row + 1 + x * 3)
  }
  const chunk = (type: string, data: Uint8Array) => {
    const body = new Uint8Array(4 + data.length)
    body.set(new TextEncoder().encode(type), 0)
    body.set(data, 4)
    const out = new Uint8Array(12 + data.length)
    const view = new DataView(out.buffer)
    view.setUint32(0, data.length)
    out.set(body, 4)
    view.setUint32(8 + data.length, crc32(body))
    return out
  }
  const header = new Uint8Array(13)
  const headerView = new DataView(header.buffer)
  headerView.setUint32(0, width)
  headerView.setUint32(4, height)
  header.set([8, 2, 0, 0, 0], 8) // 8-bit RGB, deflate, no filter, no interlace
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlibSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export const pngDataUrl = (png: Uint8Array) =>
  `data:image/png;base64,${btoa(String.fromCharCode(...png))}`
