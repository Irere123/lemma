import { makeCiteKey } from './citekey'
import { type CslItem, type CslName, normalizeItem } from './csl'
import { calendarDate, parseDateString } from './dates'
import { arxivBaseId, cleanDoi, type Identifier } from './identifiers'
import { parseName } from './names'
import { collapseWhitespace, decodeEntities, isRecord, stripMarkup } from './util'

// Turn a DOI, arXiv id, ISBN or URL into a CSL item using public metadata
// services. `fetch` is injected so the same code runs in a Worker, the
// browser and tests (which never touch the network).

export type ResolveErrorKind = 'not-found' | 'network' | 'unsupported'

export class ResolveError extends Error {
  readonly kind: ResolveErrorKind

  constructor(kind: ResolveErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ResolveError'
    this.kind = kind
  }
}

export type ResolveOptions = {
  /** Used for `accessed` on web pages; defaults to the current time. */
  now?: Date
  signal?: AbortSignal
  /** Upper bound on how much of a web page is read (default 512 KB). */
  maxBytes?: number
}

type Fetch = typeof fetch

const DEFAULT_MAX_BYTES = 512 * 1024

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

async function get(
  fetchFn: Fetch,
  url: string,
  accept: string,
  options: ResolveOptions
): Promise<Response> {
  let response: Response
  try {
    response = await fetchFn(url, {
      headers: { Accept: accept },
      redirect: 'follow',
      signal: options.signal,
    })
  } catch (error) {
    throw new ResolveError('network', `Could not reach ${hostOf(url)}`, { cause: error })
  }
  if (response.status === 404 || response.status === 410) {
    throw new ResolveError('not-found', `${hostOf(url)} has no record for this identifier`)
  }
  if (response.status === 406 || response.status === 415) {
    throw new ResolveError('unsupported', `${hostOf(url)} offers no citation metadata here`)
  }
  if (!response.ok) {
    throw new ResolveError('network', `${hostOf(url)} responded with HTTP ${response.status}`)
  }
  return response
}

async function readJson(response: Response, what: string): Promise<unknown> {
  try {
    return await response.json()
  } catch (error) {
    throw new ResolveError('unsupported', `Unreadable response for ${what}`, { cause: error })
  }
}

function withKey(item: CslItem): CslItem {
  item.id = makeCiteKey(item, new Set())
  return item
}

// ---------------------------------------------------------------------------
// DOI: content negotiation on doi.org (Crossref, DataCite, mEDRA, …)

function encodeDoi(doi: string): string {
  return doi.split('/').map(encodeURIComponent).join('/')
}

function cleanAbstract(value: string): string {
  // JATS abstracts are paragraphs; keep a space where blocks meet, and drop a
  // leading "Abstract" heading.
  return stripMarkup(value.replace(/<\/?(?:jats:)?(?:p|sec|title)\b[^>]*>/gi, ' ')).replace(
    /^abstract[:.]?\s+/i,
    ''
  )
}

function itemFromDoiCsl(raw: unknown, doi: string): CslItem {
  if (!isRecord(raw)) throw new ResolveError('unsupported', `No citation metadata for ${doi}`)
  const source = { ...raw }
  // Crossref sometimes omits `issued` but has the print/online dates.
  if (!source.issued)
    source.issued = source['published-print'] ?? source['published-online'] ?? source.created
  const item = normalizeItem(source)
  for (const field of ['title', 'container-title', 'collection-title', 'event-title'] as const) {
    const value = item[field]
    if (value) item[field] = stripMarkup(value)
  }
  if (item.abstract) item.abstract = cleanAbstract(item.abstract)
  if (!item.DOI) item.DOI = doi
  if (!item.title) throw new ResolveError('unsupported', `No title in the metadata for ${doi}`)
  return withKey(item)
}

async function resolveDoi(doi: string, fetchFn: Fetch, options: ResolveOptions): Promise<CslItem> {
  const response = await get(
    fetchFn,
    `https://doi.org/${encodeDoi(doi)}`,
    'application/vnd.citationstyles.csl+json',
    options
  )
  const type = response.headers.get('content-type') ?? ''
  if (type && !/json/i.test(type)) {
    // The registration agency answered with its landing page instead.
    throw new ResolveError('unsupported', `No citation metadata for ${doi}`)
  }
  return itemFromDoiCsl(await readJson(response, doi), doi)
}

// ---------------------------------------------------------------------------
// arXiv: the Atom API

function xmlText(xml: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml)
  if (!m) return undefined
  const value = collapseWhitespace(
    decodeEntities(m[1]!.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
  )
  return value || undefined
}

function xmlAll(xml: string, tag: string): string[] {
  const out: string[] = []
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi')
  for (let m = re.exec(xml); m; m = re.exec(xml)) out.push(m[1]!)
  return out
}

async function resolveArxiv(id: string, fetchFn: Fetch, options: ResolveOptions): Promise<CslItem> {
  const response = await get(
    fetchFn,
    `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`,
    'application/atom+xml',
    options
  )
  const xml = await response.text()
  const entry = xmlAll(xml, 'entry')[0]
  const title = entry ? xmlText(entry, 'title') : undefined
  // Unknown ids come back as an entry whose id points at /api/errors.
  if (!entry || !title || /\/api\/errors/.test(xmlText(entry, 'id') ?? '')) {
    throw new ResolveError('not-found', `arXiv has no paper ${id}`)
  }

  // Cite the paper, not a version: DataCite registers the unversioned DOI.
  const base = arxivBaseId(id)
  const item: CslItem = { id: '', type: 'article', title }
  const authors = xmlAll(entry, 'author')
    .map((block) => xmlText(block, 'name'))
    .filter((name): name is string => Boolean(name))
    .map((name) => parseName(name))
    .filter((name) => name.family || name.literal)
  if (authors.length) item.author = authors
  const published = xmlText(entry, 'published')
  const issued = published ? parseDateString(published) : undefined
  if (issued) item.issued = issued
  const summary = xmlText(entry, 'summary')
  if (summary) item.abstract = summary
  item['container-title'] = 'arXiv'
  item.archive = 'arXiv'
  item.number = `arXiv:${base}`
  item.URL = `https://arxiv.org/abs/${base}`
  const journalDoi = cleanDoi(xmlText(entry, 'arxiv:doi') ?? '')
  item.DOI = journalDoi ?? `10.48550/arXiv.${base}`
  const journalRef = xmlText(entry, 'arxiv:journal_ref')
  if (journalRef) item.note = journalRef
  return withKey(item)
}

// ---------------------------------------------------------------------------
// ISBN: Open Library, then Google Books

function yearOnly(value: unknown): CslItem['issued'] {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const year = parseDateString(String(value))?.['date-parts']?.[0]?.[0]
  return year ? { 'date-parts': [[year]] } : undefined
}

function joinTitle(title: unknown, subtitle: unknown): string | undefined {
  if (typeof title !== 'string' || !title.trim()) return undefined
  const main = collapseWhitespace(title)
  if (typeof subtitle !== 'string' || !subtitle.trim()) return main
  return `${main}${/[?!:.]$/.test(main) ? '' : ':'} ${collapseWhitespace(subtitle)}`
}

function nameOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (isRecord(value) && typeof value.name === 'string') return value.name
  return undefined
}

function personList(values: unknown): CslName[] | undefined {
  if (!Array.isArray(values)) return undefined
  const names = values
    .map(nameOf)
    .filter((n): n is string => Boolean(n?.trim()))
    .map((n) => parseName(n))
    .filter((n) => n.family || n.literal)
  return names.length ? names : undefined
}

async function openLibrary(isbn: string, fetchFn: Fetch, options: ResolveOptions) {
  const response = await get(
    fetchFn,
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    'application/json',
    options
  )
  const data = await readJson(response, `ISBN ${isbn}`)
  const book = isRecord(data) ? data[`ISBN:${isbn}`] : undefined
  if (!isRecord(book)) return null
  const title = joinTitle(book.title, book.subtitle)
  if (!title) return null
  const item: CslItem = { id: '', type: 'book', title, ISBN: isbn }
  const author = personList(book.authors)
  if (author) item.author = author
  const issued = yearOnly(book.publish_date)
  if (issued) item.issued = issued
  const publisher = Array.isArray(book.publishers) ? nameOf(book.publishers[0]) : undefined
  if (publisher) item.publisher = collapseWhitespace(publisher)
  const place = Array.isArray(book.publish_places) ? nameOf(book.publish_places[0]) : undefined
  if (place) item['publisher-place'] = collapseWhitespace(place)
  if (typeof book.number_of_pages === 'number')
    item['number-of-pages'] = String(book.number_of_pages)
  return withKey(item)
}

async function googleBooks(isbn: string, fetchFn: Fetch, options: ResolveOptions) {
  const response = await get(
    fetchFn,
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
    'application/json',
    options
  )
  const data = await readJson(response, `ISBN ${isbn}`)
  const first = isRecord(data) && Array.isArray(data.items) ? data.items[0] : undefined
  const info = isRecord(first) ? first.volumeInfo : undefined
  if (!isRecord(info)) return null
  const title = joinTitle(info.title, info.subtitle)
  if (!title) return null
  const item: CslItem = { id: '', type: 'book', title, ISBN: isbn }
  const author = personList(info.authors)
  if (author) item.author = author
  const issued = yearOnly(info.publishedDate)
  if (issued) item.issued = issued
  if (typeof info.publisher === 'string' && info.publisher.trim()) {
    item.publisher = collapseWhitespace(info.publisher)
  }
  if (typeof info.pageCount === 'number') item['number-of-pages'] = String(info.pageCount)
  return withKey(item)
}

async function resolveIsbn(
  isbn: string,
  fetchFn: Fetch,
  options: ResolveOptions
): Promise<CslItem> {
  const failures: ResolveError[] = []
  for (const source of [openLibrary, googleBooks]) {
    try {
      const item = await source(isbn, fetchFn, options)
      if (item) return item
    } catch (error) {
      if (!(error instanceof ResolveError)) throw error
      failures.push(error)
    }
  }
  // Only report a network problem when no service could answer at all.
  if (failures.length === 2 && failures.every((e) => e.kind === 'network')) throw failures[0]!
  throw new ResolveError('not-found', `No book found for ISBN ${isbn}`)
}

// ---------------------------------------------------------------------------
// URL: Highwire/Google Scholar `citation_*` tags, Open Graph, JSON-LD, <title>

async function readLimited(response: Response, limit: number): Promise<string> {
  const charset = /charset=["']?([\w-]+)/i.exec(response.headers.get('content-type') ?? '')?.[1]
  let decoder: TextDecoder
  try {
    decoder = new TextDecoder(charset ?? 'utf-8')
  } catch {
    decoder = new TextDecoder('utf-8')
  }
  const body = response.body
  if (!body) return (await response.text()).slice(0, limit)
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < limit) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.byteLength
  }
  if (size >= limit) await reader.cancel().catch(() => {})
  const bytes = new Uint8Array(Math.min(size, limit))
  let offset = 0
  for (const chunk of chunks) {
    const part = chunk.subarray(0, bytes.length - offset)
    bytes.set(part, offset)
    offset += part.length
    if (offset >= bytes.length) break
  }
  return decoder.decode(bytes)
}

type PageMeta = {
  meta: Map<string, string[]>
  jsonLd: Record<string, unknown>[]
  title?: string
}

function parseAttributes(source: string): Map<string, string> {
  const attrs = new Map<string, string>()
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g
  for (let m = re.exec(source); m; m = re.exec(source)) {
    attrs.set(m[1]!.toLowerCase(), decodeEntities(m[2] ?? m[3] ?? m[4] ?? ''))
  }
  return attrs
}

function flattenJsonLd(value: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const v of value) flattenJsonLd(v, out)
  } else if (isRecord(value)) {
    out.push(value)
    if (value['@graph']) flattenJsonLd(value['@graph'], out)
  }
}

function parsePageMeta(html: string): PageMeta {
  const source = html.replace(/<!--[\s\S]*?-->/g, '')
  const meta = new Map<string, string[]>()
  const metaRe = /<meta\b([^>]*)>/gi
  for (let m = metaRe.exec(source); m; m = metaRe.exec(source)) {
    const attrs = parseAttributes(m[1]!)
    const key = (attrs.get('name') ?? attrs.get('property') ?? attrs.get('itemprop'))?.toLowerCase()
    const content = collapseWhitespace(attrs.get('content') ?? '')
    if (!key || !content) continue
    const list = meta.get(key)
    if (list) list.push(content)
    else meta.set(key, [content])
  }

  const jsonLd: Record<string, unknown>[] = []
  const ldRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  for (let m = ldRe.exec(source); m; m = ldRe.exec(source)) {
    if (!/application\/ld\+json/i.test(m[1]!)) continue
    try {
      flattenJsonLd(JSON.parse(m[2]!.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '')), jsonLd)
    } catch {
      // Broken JSON-LD is common; the other sources still apply.
    }
  }

  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(source)
  const title = titleMatch ? collapseWhitespace(decodeEntities(titleMatch[1]!)) : undefined
  return { meta, jsonLd, title: title || undefined }
}

function types(node: Record<string, unknown>): string[] {
  const t = node['@type']
  return (Array.isArray(t) ? t : [t]).filter((v): v is string => typeof v === 'string')
}

function pickJsonLd(nodes: Record<string, unknown>[]): Record<string, unknown> | undefined {
  const article = /(?:Article|BlogPosting|Report|Thesis|Chapter)$/
  return (
    nodes.find((n) => types(n).some((t) => article.test(t))) ??
    nodes.find((n) => types(n).some((t) => /WebPage$/.test(t)) && (n.headline || n.name))
  )
}

function jsonLdAuthors(value: unknown): CslName[] {
  const list = Array.isArray(value) ? value : value ? [value] : []
  const names: CslName[] = []
  for (const entry of list) {
    const name = nameOf(entry)?.trim()
    if (!name) continue
    const isOrg = isRecord(entry) && types(entry).some((t) => /Organization$/.test(t))
    const parsed = isOrg ? { literal: name } : parseName(name)
    if (parsed.family || parsed.literal) names.push(parsed)
  }
  return names
}

// A meta `author` may hold one name or several ("Jane Doe, John Roe and Ann Poe").
function metaAuthors(values: string[]): CslName[] {
  const names: CslName[] = []
  for (const raw of values) {
    const value = raw.replace(/^by\s+/i, '').trim()
    if (!value || /^https?:\/\/|^@/.test(value)) continue
    const parts = value.split(/\s*(?:,|;|&|\band\b)\s*/).filter(Boolean)
    const several = parts.length > 1 && parts.every((p) => p.split(/\s+/).length >= 2)
    for (const part of several ? parts : [value]) {
      const name = parseName(part)
      if (name.family || name.literal) names.push(name)
    }
  }
  return names
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function itemFromPage(url: string, page: PageMeta, now: Date): CslItem {
  const first = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = page.meta.get(key)?.[0]
      if (value) return value
    }
    return undefined
  }
  const all = (key: string): string[] => page.meta.get(key) ?? []
  const ld = pickJsonLd(page.jsonLd)
  const ldString = (key: string): string | undefined => {
    const value = ld?.[key]
    return typeof value === 'string' && value.trim() ? collapseWhitespace(value) : undefined
  }

  const siteName = first('og:site_name') ?? nameOf(ld?.publisher) ?? first('application-name')
  let title =
    first('citation_title', 'dc.title') ??
    first('og:title', 'twitter:title') ??
    ldString('headline') ??
    ldString('name') ??
    page.title
  // "Article title | Site Name" → "Article title".
  if (title && siteName && title !== siteName) {
    title = title.replace(new RegExp(`\\s+[|\\-–—:·]\\s+${escapeRegExp(siteName)}$`, 'i'), '')
  }

  const journal = first('citation_journal_title')
  const item: CslItem = { id: '', type: journal ? 'article-journal' : 'webpage' }
  if (title) item.title = stripMarkup(title)

  let authors = all('citation_author')
    .map((name) => parseName(name))
    .filter((n) => n.family || n.literal)
  if (!authors.length && ld) authors = jsonLdAuthors(ld.author)
  if (!authors.length) authors = metaAuthors([...all('author'), ...all('dc.creator')])
  if (authors.length) item.author = authors

  const dateText =
    first('citation_publication_date', 'citation_date', 'citation_online_date') ??
    first('article:published_time') ??
    ldString('datePublished') ??
    first('dc.date', 'dc.date.issued', 'date', 'pubdate')
  const issued = dateText ? parseDateString(dateText) : undefined
  if (issued?.['date-parts']) item.issued = issued

  if (journal) {
    item['container-title'] = journal
    const volume = first('citation_volume')
    if (volume) item.volume = volume
    const issue = first('citation_issue')
    if (issue) item.issue = issue
    const firstPage = first('citation_firstpage')
    const lastPage = first('citation_lastpage')
    if (firstPage)
      item.page = lastPage && lastPage !== firstPage ? `${firstPage}-${lastPage}` : firstPage
    const publisher = first('citation_publisher', 'dc.publisher')
    if (publisher) item.publisher = publisher
    const issn = first('citation_issn')
    if (issn) item.ISSN = issn
  } else if (siteName && siteName !== item.title) {
    item['container-title'] = siteName
  }
  const abstract = first('citation_abstract')
  if (abstract) item.abstract = stripMarkup(abstract)
  const language = first('citation_language', 'dc.language')
  if (language) item.language = language

  item.URL = url
  item.accessed = calendarDate(now)
  return withKey(item)
}

async function resolveUrl(url: string, fetchFn: Fetch, options: ResolveOptions): Promise<CslItem> {
  const response = await get(
    fetchFn,
    url,
    'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
    options
  )
  const type = response.headers.get('content-type') ?? ''
  if (type && !/html|xml/i.test(type)) {
    await response.body?.cancel().catch(() => {})
    throw new ResolveError('unsupported', `${url} is not a web page (${type.split(';')[0]})`)
  }
  const page = parsePageMeta(await readLimited(response, options.maxBytes ?? DEFAULT_MAX_BYTES))

  const doiTag = page.meta.get('citation_doi')?.[0] ?? page.meta.get('prism.doi')?.[0]
  const doi = doiTag ? cleanDoi(doiTag) : null
  if (doi) {
    try {
      return await resolveDoi(doi, fetchFn, options)
    } catch (error) {
      // The page's own tags are still a good citation.
      if (!(error instanceof ResolveError)) throw error
    }
  }
  return itemFromPage(url, page, options.now ?? new Date())
}

/**
 * Fetch metadata for an identifier from doi.org, the arXiv API, Open
 * Library / Google Books, or the page itself. Throws `ResolveError`.
 */
export async function resolveIdentifier(
  id: Identifier,
  fetchFn: Fetch,
  options: ResolveOptions = {}
): Promise<CslItem> {
  switch (id.kind) {
    case 'doi':
      return resolveDoi(id.value, fetchFn, options)
    case 'arxiv':
      return resolveArxiv(id.value, fetchFn, options)
    case 'isbn':
      return resolveIsbn(id.value, fetchFn, options)
    case 'url':
      return resolveUrl(id.value, fetchFn, options)
    default:
      throw new ResolveError(
        'unsupported',
        `Cannot resolve identifiers of kind "${(id as Identifier).kind}"`
      )
  }
}
