import { describe, expect, test } from 'bun:test'

import { ResolveError, resolveIdentifier } from '../../src/citations'

// Every request goes through this mock; nothing touches the network.
type Reply = { status?: number; type?: string; body: string } | Error

function mockFetch(routes: Record<string, Reply | ((url: string) => Reply)>) {
  const calls: { url: string; accept: string | null }[] = []
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, accept: new Headers(init?.headers).get('accept') })
    const route = routes[url]
    if (!route) return new Response('not found', { status: 404 })
    const reply = typeof route === 'function' ? route(url) : route
    if (reply instanceof Error) throw reply
    return new Response(reply.body, {
      status: reply.status ?? 200,
      headers: { 'content-type': reply.type ?? 'application/json' },
    })
  }) as typeof fetch
  return { fetchFn, calls }
}

const json = (value: unknown, type = 'application/vnd.citationstyles.csl+json') => ({
  body: JSON.stringify(value),
  type,
})

async function failure(promise: Promise<unknown>): Promise<ResolveError> {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(ResolveError)
    return error as ResolveError
  }
  throw new Error('expected a ResolveError')
}

// doi.org → Crossref CSL-JSON, trimmed from a real response for 10.1038/nature14539.
const CROSSREF = {
  indexed: { 'date-parts': [[2024, 1, 2]], timestamp: 1704153600000 },
  'reference-count': 103,
  publisher: 'Springer Science and Business Media LLC',
  issue: '7553',
  license: [{ start: { 'date-parts': [[2015, 5, 1]] }, URL: 'https://www.springer.com/tdm' }],
  'content-domain': { domain: ['link.springer.com'], 'crossmark-restriction': false },
  'short-container-title': ['Nature'],
  abstract:
    '<jats:title>Abstract</jats:title><jats:p>Deep learning allows <jats:italic>computational models</jats:italic> to learn.</jats:p><jats:p>Second paragraph.</jats:p>',
  DOI: '10.1038/nature14539',
  type: 'article-journal',
  created: { 'date-parts': [[2015, 5, 27]] },
  page: '436-444',
  source: 'Crossref',
  title:
    'Deep learning with <i>CO<sub>2</sub></i> and <jats:italic>E. coli</jats:italic> &amp; friends',
  prefix: '10.1038',
  volume: '521',
  author: [
    { given: 'Yann', family: 'LeCun', sequence: 'first', affiliation: [] },
    { given: 'Yoshua', family: 'Bengio', sequence: 'additional', affiliation: [] },
    { given: 'Geoffrey', family: 'Hinton', sequence: 'additional', affiliation: [] },
  ],
  member: '297',
  reference: [{ key: '1', 'doi-asserted-by': 'publisher', DOI: '10.1/x' }],
  'container-title': ['Nature'],
  'original-title': [],
  language: 'en',
  link: [
    { URL: 'http://www.nature.com/articles/nature14539.pdf', 'content-type': 'application/pdf' },
  ],
  assertion: [{ value: 'Received', name: 'received' }],
  issued: { 'date-parts': [[2015, 5, 27]] },
  URL: 'https://doi.org/10.1038/nature14539',
  ISSN: ['0028-0836', '1476-4687'],
  'container-title-short': 'Nature',
  published: { 'date-parts': [[2015, 5, 27]] },
}

describe('resolveIdentifier: DOI', () => {
  test('content negotiation on doi.org, with JATS markup and heavy fields cleaned', async () => {
    const { fetchFn, calls } = mockFetch({ 'https://doi.org/10.1038/nature14539': json(CROSSREF) })
    const item = await resolveIdentifier({ kind: 'doi', value: '10.1038/nature14539' }, fetchFn)
    expect(calls).toEqual([
      {
        url: 'https://doi.org/10.1038/nature14539',
        accept: 'application/vnd.citationstyles.csl+json',
      },
    ])
    expect(item).toEqual({
      id: 'lecun2015deep',
      type: 'article-journal',
      title: 'Deep learning with CO2 and E. coli & friends',
      'container-title': 'Nature',
      author: [
        { family: 'LeCun', given: 'Yann' },
        { family: 'Bengio', given: 'Yoshua' },
        { family: 'Hinton', given: 'Geoffrey' },
      ],
      issued: { 'date-parts': [[2015, 5, 27]] },
      volume: '521',
      issue: '7553',
      page: '436-444',
      publisher: 'Springer Science and Business Media LLC',
      DOI: '10.1038/nature14539',
      URL: 'https://doi.org/10.1038/nature14539',
      ISSN: '0028-0836',
      abstract: 'Deep learning allows computational models to learn. Second paragraph.',
      language: 'en',
    })
  })

  test('falls back to published-print when issued is missing; encodes the DOI', async () => {
    const { issued, ...rest } = CROSSREF
    const doi = '10.1002/(SICI)1097-4636#x'
    const { fetchFn, calls } = mockFetch({
      'https://doi.org/10.1002/(SICI)1097-4636%23x': json({
        ...rest,
        'published-print': { 'date-parts': [[2014, 9]] },
      }),
    })
    const item = await resolveIdentifier({ kind: 'doi', value: doi }, fetchFn)
    expect(calls[0]!.url).toBe('https://doi.org/10.1002/(SICI)1097-4636%23x')
    expect(item.issued).toEqual({ 'date-parts': [[2014, 9]] })
  })

  test('404 → not-found, 406 or a landing page → unsupported, failures → network', async () => {
    const doi = { kind: 'doi', value: '10.1000/none' } as const
    expect((await failure(resolveIdentifier(doi, mockFetch({}).fetchFn))).kind).toBe('not-found')
    const notAcceptable = mockFetch({ 'https://doi.org/10.1000/none': { status: 406, body: '' } })
    expect((await failure(resolveIdentifier(doi, notAcceptable.fetchFn))).kind).toBe('unsupported')
    const landing = mockFetch({
      'https://doi.org/10.1000/none': { type: 'text/html', body: '<html></html>' },
    })
    expect((await failure(resolveIdentifier(doi, landing.fetchFn))).kind).toBe('unsupported')
    const offline = mockFetch({ 'https://doi.org/10.1000/none': new TypeError('fetch failed') })
    const error = await failure(resolveIdentifier(doi, offline.fetchFn))
    expect(error.kind).toBe('network')
    expect(error.cause).toBeInstanceOf(TypeError)
    const down = mockFetch({ 'https://doi.org/10.1000/none': { status: 503, body: '' } })
    expect((await failure(resolveIdentifier(doi, down.fetchFn))).kind).toBe('network')
  })
})

// export.arxiv.org Atom feed for one id.
const atom = (entry: string) => `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <link href="http://arxiv.org/api/query?search_query=&amp;id_list=1706.03762" rel="self" type="application/atom+xml"/>
  <title type="html">ArXiv Query: search_query=&amp;id_list=1706.03762&amp;start=0&amp;max_results=10</title>
  <id>http://arxiv.org/api/cHxbiOdZaP56ODnBPIenZhzg5f8</id>
  <updated>2024-01-01T00:00:00-05:00</updated>
  <opensearch:totalResults xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">1</opensearch:totalResults>
  ${entry}
</feed>`

const ATTENTION = atom(`<entry>
    <id>http://arxiv.org/abs/1706.03762v7</id>
    <updated>2023-08-02T00:41:18Z</updated>
    <published>2017-06-12T17:57:34Z</published>
    <title>Attention Is All
  You Need</title>
    <summary>  The dominant sequence transduction models are based on complex recurrent &amp;
convolutional neural networks.
</summary>
    <author><name>Ashish Vaswani</name></author>
    <author><name>Noam Shazeer</name></author>
    <author><name>Łukasz Kaiser</name></author>
    <arxiv:comment xmlns:arxiv="http://arxiv.org/schemas/atom">15 pages, 5 figures</arxiv:comment>
    <link href="http://arxiv.org/abs/1706.03762v7" rel="alternate" type="text/html"/>
    <link title="pdf" href="http://arxiv.org/pdf/1706.03762v7" rel="related" type="application/pdf"/>
    <arxiv:primary_category xmlns:arxiv="http://arxiv.org/schemas/atom" term="cs.CL" scheme="http://arxiv.org/schemas/atom"/>
  </entry>`)

describe('resolveIdentifier: arXiv', () => {
  test('parses the Atom entry into a preprint with the arXiv DOI', async () => {
    const { fetchFn, calls } = mockFetch({
      'https://export.arxiv.org/api/query?id_list=1706.03762v2': {
        type: 'application/atom+xml',
        body: ATTENTION,
      },
    })
    const item = await resolveIdentifier({ kind: 'arxiv', value: '1706.03762v2' }, fetchFn)
    expect(calls[0]!.accept).toBe('application/atom+xml')
    expect(item).toEqual({
      id: 'vaswani2017attention',
      type: 'article',
      title: 'Attention Is All You Need',
      author: [
        { family: 'Vaswani', given: 'Ashish' },
        { family: 'Shazeer', given: 'Noam' },
        { family: 'Kaiser', given: 'Łukasz' },
      ],
      issued: { 'date-parts': [[2017, 6, 12]] },
      abstract:
        'The dominant sequence transduction models are based on complex recurrent & convolutional neural networks.',
      'container-title': 'arXiv',
      archive: 'arXiv',
      number: 'arXiv:1706.03762',
      URL: 'https://arxiv.org/abs/1706.03762',
      DOI: '10.48550/arXiv.1706.03762',
    })
  })

  test('prefers the journal DOI and keeps the journal reference', async () => {
    const feed = atom(`<entry>
      <id>http://arxiv.org/abs/hep-th/9901001v1</id>
      <published>1999-01-01T00:00:00Z</published>
      <title>Old style</title>
      <author><name>Jan van der Berg</name></author>
      <arxiv:doi xmlns:arxiv="http://arxiv.org/schemas/atom">10.1103/PhysRevD.60.000001</arxiv:doi>
      <arxiv:journal_ref xmlns:arxiv="http://arxiv.org/schemas/atom">Phys. Rev. D 60, 000001 (1999)</arxiv:journal_ref>
    </entry>`)
    const { fetchFn } = mockFetch({
      'https://export.arxiv.org/api/query?id_list=hep-th%2F9901001': {
        type: 'application/atom+xml',
        body: feed,
      },
    })
    const item = await resolveIdentifier({ kind: 'arxiv', value: 'hep-th/9901001' }, fetchFn)
    expect(item).toMatchObject({
      DOI: '10.1103/PhysRevD.60.000001',
      note: 'Phys. Rev. D 60, 000001 (1999)',
      number: 'arXiv:hep-th/9901001',
      author: [{ family: 'Berg', given: 'Jan', 'non-dropping-particle': 'van der' }],
    })
  })

  test('the API error entry and an empty feed mean not-found', async () => {
    const error = atom(`<entry>
      <id>http://arxiv.org/api/errors#incorrect_id_format_for_2399.99999</id>
      <title>Error</title>
      <summary>incorrect id format for 2399.99999</summary>
    </entry>`)
    for (const body of [error, atom('')]) {
      const { fetchFn } = mockFetch({
        'https://export.arxiv.org/api/query?id_list=2312.99999': {
          type: 'application/atom+xml',
          body,
        },
      })
      expect(
        (await failure(resolveIdentifier({ kind: 'arxiv', value: '2312.99999' }, fetchFn))).kind
      ).toBe('not-found')
    }
  })
})

const OPEN_LIBRARY =
  'https://openlibrary.org/api/books?bibkeys=ISBN:9780262033848&format=json&jscmd=data'
const GOOGLE_BOOKS = 'https://www.googleapis.com/books/v1/volumes?q=isbn:9780262033848'

describe('resolveIdentifier: ISBN', () => {
  test('Open Library', async () => {
    const { fetchFn, calls } = mockFetch({
      [OPEN_LIBRARY]: json(
        {
          'ISBN:9780262033848': {
            url: 'https://openlibrary.org/books/OL22724223M/Introduction_to_algorithms',
            key: '/books/OL22724223M',
            title: 'Introduction to algorithms',
            subtitle: 'third edition',
            authors: [
              { url: 'https://openlibrary.org/authors/OL1A', name: 'Thomas H. Cormen' },
              { url: 'https://openlibrary.org/authors/OL2A', name: 'Charles E. Leiserson' },
            ],
            number_of_pages: 1292,
            identifiers: { isbn_13: ['9780262033848'] },
            publishers: [{ name: 'MIT Press' }],
            publish_places: [{ name: 'Cambridge, Mass' }],
            publish_date: 'July 31, 2009',
          },
        },
        'application/json'
      ),
    })
    const item = await resolveIdentifier({ kind: 'isbn', value: '9780262033848' }, fetchFn)
    expect(calls.map((c) => c.url)).toEqual([OPEN_LIBRARY])
    expect(item).toEqual({
      id: 'cormen2009introduction',
      type: 'book',
      title: 'Introduction to algorithms: third edition',
      ISBN: '9780262033848',
      author: [
        { family: 'Cormen', given: 'Thomas H.' },
        { family: 'Leiserson', given: 'Charles E.' },
      ],
      issued: { 'date-parts': [[2009]] },
      publisher: 'MIT Press',
      'publisher-place': 'Cambridge, Mass',
      'number-of-pages': '1292',
    })
  })

  test('falls back to Google Books when Open Library has no record', async () => {
    const { fetchFn, calls } = mockFetch({
      [OPEN_LIBRARY]: json({}, 'application/json'),
      [GOOGLE_BOOKS]: json(
        {
          kind: 'books#volumes',
          totalItems: 1,
          items: [
            {
              kind: 'books#volume',
              id: 'i8hQhp1a62UC',
              volumeInfo: {
                title: 'Introduction to Algorithms',
                authors: [
                  'Thomas H. Cormen',
                  'Charles E. Leiserson',
                  'Ronald L. Rivest',
                  'Clifford Stein',
                ],
                publisher: 'MIT Press',
                publishedDate: '2009-07-31',
                pageCount: 1313,
                industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780262033848' }],
              },
            },
          ],
        },
        'application/json'
      ),
    })
    const item = await resolveIdentifier({ kind: 'isbn', value: '9780262033848' }, fetchFn)
    expect(calls.map((c) => c.url)).toEqual([OPEN_LIBRARY, GOOGLE_BOOKS])
    expect(item).toMatchObject({
      type: 'book',
      title: 'Introduction to Algorithms',
      publisher: 'MIT Press',
      issued: { 'date-parts': [[2009]] },
      'number-of-pages': '1313',
    })
    expect(item.author).toHaveLength(4)
  })

  test('not-found when neither service knows it; network when both are unreachable', async () => {
    const empty = mockFetch({
      [OPEN_LIBRARY]: json({}, 'application/json'),
      [GOOGLE_BOOKS]: json({ kind: 'books#volumes', totalItems: 0 }, 'application/json'),
    })
    expect(
      (await failure(resolveIdentifier({ kind: 'isbn', value: '9780262033848' }, empty.fetchFn)))
        .kind
    ).toBe('not-found')
    const offline = mockFetch({
      [OPEN_LIBRARY]: new TypeError('offline'),
      [GOOGLE_BOOKS]: new TypeError('offline'),
    })
    expect(
      (await failure(resolveIdentifier({ kind: 'isbn', value: '9780262033848' }, offline.fetchFn)))
        .kind
    ).toBe('network')
  })
})

const NOW = new Date('2026-10-21T12:00:00Z')
const html = (body: string) => ({ type: 'text/html; charset=utf-8', body })

const HIGHWIRE_PAGE = `<!doctype html>
<html><head>
<meta charset="utf-8">
<title>Deep residual learning | Journal of Vision</title>
<!-- <meta name="citation_title" content="Commented out"> -->
<meta name="citation_title" content="Deep residual learning for image recognition">
<meta name="citation_author" content="He, Kaiming">
<meta name="citation_author" content="Zhang, Xiangyu">
<meta name="citation_author" content="Shaoqing Ren">
<meta name="citation_publication_date" content="2016/06/27">
<meta name="citation_journal_title" content="Journal of Vision">
<meta name="citation_volume" content="16">
<meta name="citation_issue" content="12">
<meta name="citation_firstpage" content="770">
<meta name="citation_lastpage" content="778">
<meta name="citation_publisher" content="ARVO">
<meta property='og:site_name' content='Journal of Vision'>
</head><body><h1>Deep residual learning</h1></body></html>`

describe('resolveIdentifier: URL', () => {
  test('Highwire citation_* tags make a journal article', async () => {
    const url = 'https://jov.example.org/article/123'
    const { fetchFn, calls } = mockFetch({ [url]: html(HIGHWIRE_PAGE) })
    const item = await resolveIdentifier({ kind: 'url', value: url }, fetchFn, { now: NOW })
    expect(calls[0]!.accept).toContain('text/html')
    expect(item).toEqual({
      id: 'he2016deep',
      type: 'article-journal',
      title: 'Deep residual learning for image recognition',
      author: [
        { family: 'He', given: 'Kaiming' },
        { family: 'Zhang', given: 'Xiangyu' },
        { family: 'Ren', given: 'Shaoqing' },
      ],
      issued: { 'date-parts': [[2016, 6, 27]] },
      'container-title': 'Journal of Vision',
      volume: '16',
      issue: '12',
      page: '770-778',
      publisher: 'ARVO',
      URL: url,
      accessed: { 'date-parts': [[2026, 10, 21]] },
    })
  })

  test('citation_doi resolves the DOI instead, falling back to the page when that fails', async () => {
    const url = 'https://www.nature.com/articles/nature14539'
    const page = HIGHWIRE_PAGE.replace(
      '</head>',
      '<meta name="citation_doi" content="doi:10.1038/nature14539"></head>'
    )
    const ok = mockFetch({
      [url]: html(page),
      'https://doi.org/10.1038/nature14539': json(CROSSREF),
    })
    const item = await resolveIdentifier({ kind: 'url', value: url }, ok.fetchFn, { now: NOW })
    expect(ok.calls.map((c) => c.url)).toEqual([url, 'https://doi.org/10.1038/nature14539'])
    expect(item.id).toBe('lecun2015deep')
    expect(item.DOI).toBe('10.1038/nature14539')

    const broken = mockFetch({ [url]: html(page) })
    const fallback = await resolveIdentifier({ kind: 'url', value: url }, broken.fetchFn, {
      now: NOW,
    })
    expect(fallback.title).toBe('Deep residual learning for image recognition')
    expect(fallback.URL).toBe(url)
  })

  test('Open Graph and JSON-LD make a web page', async () => {
    const url = 'https://blog.example.com/how-we-built-it'
    const page = `<html><head>
      <title>Fallback title</title>
      <meta property="og:title" content="How we built it &amp; why">
      <meta property="og:site_name" content="Example Blog">
      <meta property="article:published_time" content="2023-05-14T09:00:00Z">
      <meta name="author" content="Someone Else">
      <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[
          {"@type":"WebSite","name":"Example Blog"},
          {"@type":"BlogPosting","headline":"How we built it","datePublished":"2023-05-01",
           "author":[{"@type":"Person","name":"Jane Doe"},{"@type":"Person","name":"John Roe"}],
           "publisher":{"@type":"Organization","name":"Example Inc."}}]}
      </script>
    </head><body></body></html>`
    const { fetchFn } = mockFetch({ [url]: html(page) })
    expect(await resolveIdentifier({ kind: 'url', value: url }, fetchFn, { now: NOW })).toEqual({
      id: 'doe2023built',
      type: 'webpage',
      title: 'How we built it & why',
      author: [
        { family: 'Doe', given: 'Jane' },
        { family: 'Roe', given: 'John' },
      ],
      issued: { 'date-parts': [[2023, 5, 14]] },
      'container-title': 'Example Blog',
      URL: url,
      accessed: { 'date-parts': [[2026, 10, 21]] },
    })
  })

  test('JSON-LD alone, with an organisation as author', async () => {
    const url = 'https://news.example.org/story'
    const page = `<script type="application/ld+json">[{"@type":"NewsArticle","headline":"Rates rise",
      "author":{"@type":"Organization","name":"Example News"},"datePublished":"2024-02-03T08:00:00+00:00",
      "publisher":{"@type":"Organization","name":"Example News"}}]</script><title>Rates rise - Example News</title>`
    const { fetchFn } = mockFetch({ [url]: html(page) })
    const item = await resolveIdentifier({ kind: 'url', value: url }, fetchFn, { now: NOW })
    expect(item).toMatchObject({
      type: 'webpage',
      title: 'Rates rise',
      author: [{ literal: 'Example News' }],
      issued: { 'date-parts': [[2024, 2, 3]] },
      'container-title': 'Example News',
    })
  })

  test('<title> fallback strips the site name; meta author may list several people', async () => {
    const url = 'https://example.com/notes'
    const page = `<head><title>Field notes &#8212; part 2 | Example Site</title>
      <meta property="og:site_name" content="Example Site">
      <meta name="author" content="By Jane Doe, John Roe and Ann Poe"></head>`
    const { fetchFn } = mockFetch({ [url]: html(page) })
    const item = await resolveIdentifier({ kind: 'url', value: url }, fetchFn, { now: NOW })
    expect(item.title).toBe('Field notes — part 2')
    expect(item.author).toEqual([
      { family: 'Doe', given: 'Jane' },
      { family: 'Roe', given: 'John' },
      { family: 'Poe', given: 'Ann' },
    ])
    expect(item.issued).toBeUndefined()
  })

  test('reads at most maxBytes of the page', async () => {
    const url = 'https://example.com/huge'
    const page = `<title>Early title</title>${' '.repeat(5000)}<meta name="citation_title" content="Late title">`
    const { fetchFn } = mockFetch({ [url]: html(page) })
    const limited = await resolveIdentifier({ kind: 'url', value: url }, fetchFn, {
      now: NOW,
      maxBytes: 1024,
    })
    expect(limited.title).toBe('Early title')
    const full = await resolveIdentifier({ kind: 'url', value: url }, fetchFn, { now: NOW })
    expect(full.title).toBe('Late title')
  })

  test('non-HTML responses are unsupported; missing pages are not-found', async () => {
    const url = 'https://example.com/paper.pdf'
    const pdf = mockFetch({ [url]: { type: 'application/pdf', body: '%PDF-1.7' } })
    expect((await failure(resolveIdentifier({ kind: 'url', value: url }, pdf.fetchFn))).kind).toBe(
      'unsupported'
    )
    expect(
      (await failure(resolveIdentifier({ kind: 'url', value: url }, mockFetch({}).fetchFn))).kind
    ).toBe('not-found')
  })
})
