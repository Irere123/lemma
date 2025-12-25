import type { Document, NewsletterSettings } from '@api/db/schema'

export interface RSSFeedOptions {
  title: string
  description: string
  link: string
  feedUrl: string
  language?: string
  copyright?: string
  author?: string
  imageUrl?: string
  managingEditor?: string
  webMaster?: string
  ttl?: number
  categories?: string[]
}

export interface RSSItem {
  title: string
  link: string
  description: string
  content?: string
  pubDate: Date
  guid: string
  author?: string
  categories?: string[]
  imageUrl?: string
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatRFC822Date(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  const day = days[date.getUTCDay()]
  const dayNum = date.getUTCDate().toString().padStart(2, '0')
  const month = months[date.getUTCMonth()]
  const year = date.getUTCFullYear()
  const hours = date.getUTCHours().toString().padStart(2, '0')
  const minutes = date.getUTCMinutes().toString().padStart(2, '0')
  const seconds = date.getUTCSeconds().toString().padStart(2, '0')

  return `${day}, ${dayNum} ${month} ${year} ${hours}:${minutes}:${seconds} +0000`
}

export function generateRSSFeed(options: RSSFeedOptions, items: RSSItem[]): string {
  const now = new Date()

  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(options.title)}</title>
    <link>${escapeXml(options.link)}</link>
    <description>${escapeXml(options.description)}</description>
    <language>${options.language || 'en-us'}</language>
    <lastBuildDate>${formatRFC822Date(now)}</lastBuildDate>
    <atom:link href="${escapeXml(options.feedUrl)}" rel="self" type="application/rss+xml"/>
    <ttl>${options.ttl || 60}</ttl>`

  if (options.copyright) {
    rss += `\n    <copyright>${escapeXml(options.copyright)}</copyright>`
  }

  if (options.managingEditor) {
    rss += `\n    <managingEditor>${escapeXml(options.managingEditor)}</managingEditor>`
  }

  if (options.webMaster) {
    rss += `\n    <webMaster>${escapeXml(options.webMaster)}</webMaster>`
  }

  if (options.imageUrl) {
    rss += `
    <image>
      <url>${escapeXml(options.imageUrl)}</url>
      <title>${escapeXml(options.title)}</title>
      <link>${escapeXml(options.link)}</link>
    </image>`
  }

  if (options.categories) {
    for (const category of options.categories) {
      rss += `\n    <category>${escapeXml(category)}</category>`
    }
  }

  for (const item of items) {
    rss += `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${formatRFC822Date(item.pubDate)}</pubDate>
      <guid isPermaLink="true">${escapeXml(item.guid)}</guid>`

    if (item.author) {
      rss += `\n      <author>${escapeXml(item.author)}</author>`
    }

    if (item.content) {
      rss += `\n      <content:encoded><![CDATA[${item.content}]]></content:encoded>`
    }

    if (item.categories) {
      for (const category of item.categories) {
        rss += `\n      <category>${escapeXml(category)}</category>`
      }
    }

    if (item.imageUrl) {
      rss += `\n      <enclosure url="${escapeXml(item.imageUrl)}" type="image/jpeg"/>`
    }

    rss += `
    </item>`
  }

  rss += `
  </channel>
</rss>`

  return rss
}

export function generateAtomFeed(options: RSSFeedOptions, items: RSSItem[]): string {
  const now = new Date().toISOString()

  let atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(options.title)}</title>
  <subtitle>${escapeXml(options.description)}</subtitle>
  <link href="${escapeXml(options.link)}"/>
  <link href="${escapeXml(options.feedUrl)}" rel="self"/>
  <updated>${now}</updated>
  <id>${escapeXml(options.link)}</id>`

  if (options.author) {
    atom += `
  <author>
    <name>${escapeXml(options.author)}</name>
  </author>`
  }

  if (options.imageUrl) {
    atom += `\n  <icon>${escapeXml(options.imageUrl)}</icon>`
  }

  for (const item of items) {
    const updated = item.pubDate.toISOString()

    atom += `
  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(item.link)}"/>
    <id>${escapeXml(item.guid)}</id>
    <updated>${updated}</updated>
    <summary>${escapeXml(item.description)}</summary>`

    if (item.content) {
      atom += `\n    <content type="html"><![CDATA[${item.content}]]></content>`
    }

    if (item.author) {
      atom += `
    <author>
      <name>${escapeXml(item.author)}</name>
    </author>`
    }

    if (item.categories) {
      for (const category of item.categories) {
        atom += `\n    <category term="${escapeXml(category)}"/>`
      }
    }

    atom += `
  </entry>`
  }

  atom += `
</feed>`

  return atom
}

export function documentsToRSSItems(
  documents: Document[],
  baseUrl: string,
  authorName?: string
): RSSItem[] {
  return documents.map((doc) => ({
    title: doc.title || 'Untitled',
    link: `${baseUrl}/posts/${doc.slug || doc.id}`,
    description: doc.subtitle || doc.metaDescription || doc.title || '',
    content: doc.markdown || undefined,
    pubDate: doc.publishedDate || doc.createdAt || new Date(),
    guid: `${baseUrl}/posts/${doc.slug || doc.id}`,
    author: authorName,
    imageUrl: doc.bannerImage || doc.ogImage || undefined,
  }))
}

export function generateBlogRSSFeed(
  writerSettings: NewsletterSettings,
  documents: Document[],
  baseUrl: string
): string {
  const items = documentsToRSSItems(documents, baseUrl, writerSettings.fromName)

  return generateRSSFeed(
    {
      title: writerSettings.newsletterName,
      description: `Latest posts from ${writerSettings.newsletterName}`,
      link: baseUrl,
      feedUrl: `${baseUrl}/rss.xml`,
      author: writerSettings.fromName,
      imageUrl: writerSettings.logoUrl || undefined,
    },
    items
  )
}

export function generateBlogAtomFeed(
  writerSettings: NewsletterSettings,
  documents: Document[],
  baseUrl: string
): string {
  const items = documentsToRSSItems(documents, baseUrl, writerSettings.fromName)

  return generateAtomFeed(
    {
      title: writerSettings.newsletterName,
      description: `Latest posts from ${writerSettings.newsletterName}`,
      link: baseUrl,
      feedUrl: `${baseUrl}/atom.xml`,
      author: writerSettings.fromName,
      imageUrl: writerSettings.logoUrl || undefined,
    },
    items
  )
}
