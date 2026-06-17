import { createRoute, z } from '@hono/zod-openapi'

import { getDocumentsByCategory } from '@api/db/queries/categories'
import { getPublishedArticles } from '@api/db/queries/documents'
import { getWriterNewsletterSettings } from '@api/db/queries/newsletter-settings'
import { env } from '@api/env-runtime'
import {
  documentsToRSSItems,
  generateBlogAtomFeed,
  generateBlogRSSFeed,
  generateRSSFeed,
} from '@api/lib/rss'
import { createRouter } from '@api/lib/utils'

const feedsRouter = createRouter()

// Main RSS feed
feedsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/rss.xml',
    tags: ['Feeds'],
    summary: "Get RSS feed of a writer's published articles",
    request: {
      query: z.object({
        writerId: z.string(),
        limit: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'RSS feed XML',
        content: {
          'application/rss+xml': {
            schema: z.string(),
          },
        },
      },
      404: { description: 'No articles found or writer settings not configured' },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const query = c.req.valid('query')
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 20
    const writerId = query.writerId

    const [articles, writerSettings] = await Promise.all([
      getPublishedArticles(db, { writerId, limit }),
      getWriterNewsletterSettings(db, writerId),
    ])

    if (!writerSettings) {
      return c.text('Newsletter settings not configured', 404)
    }

    const rss = generateBlogRSSFeed(writerSettings, articles as any, env.FRONTEND_URL)

    return c.text(rss, 200, {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    })
  }
)

// Atom feed
feedsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/atom.xml',
    tags: ['Feeds'],
    summary: "Get Atom feed of a writer's published articles",
    request: {
      query: z.object({
        writerId: z.string(),
        limit: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Atom feed XML',
        content: {
          'application/atom+xml': {
            schema: z.string(),
          },
        },
      },
      404: { description: 'No articles found or writer settings not configured' },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const query = c.req.valid('query')
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 20
    const writerId = query.writerId

    const [articles, writerSettings] = await Promise.all([
      getPublishedArticles(db, { writerId, limit }),
      getWriterNewsletterSettings(db, writerId),
    ])

    if (!writerSettings) {
      return c.text('Newsletter settings not configured', 404)
    }

    const atom = generateBlogAtomFeed(writerSettings, articles as any, env.FRONTEND_URL)

    return c.text(atom, 200, {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    })
  }
)

// RSS feed for a specific category
feedsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/category/:categoryId/rss.xml',
    tags: ['Feeds'],
    summary: 'Get RSS feed for a specific category',
    request: {
      params: z.object({
        categoryId: z.string(),
      }),
      query: z.object({
        limit: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'RSS feed XML',
        content: {
          'application/rss+xml': {
            schema: z.string(),
          },
        },
      },
      404: { description: 'Category not found' },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const { categoryId } = c.req.valid('param')
    const query = c.req.valid('query')
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 20

    const articles = await getDocumentsByCategory(db, categoryId, {
      limit,
      publishedOnly: true,
    })

    if (articles.length === 0) {
      return c.text('No articles found for this category', 404)
    }

    const items = documentsToRSSItems(articles, env.FRONTEND_URL)

    const rss = generateRSSFeed(
      {
        title: `Category Feed`,
        description: `Latest articles in this category`,
        link: env.FRONTEND_URL,
        feedUrl: `${env.FRONTEND_URL}/feeds/category/${categoryId}/rss.xml`,
      },
      items
    )

    return c.text(rss, 200, {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    })
  }
)

// JSON feed (modern alternative to RSS)
feedsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/feed.json',
    tags: ['Feeds'],
    summary: "Get JSON feed of a writer's published articles",
    request: {
      query: z.object({
        writerId: z.string(),
        limit: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'JSON feed',
        content: {
          'application/feed+json': {
            schema: z.object({
              version: z.string(),
              title: z.string(),
              home_page_url: z.string(),
              feed_url: z.string(),
              items: z.array(z.any()),
            }),
          },
        },
      },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const query = c.req.valid('query')
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 20
    const writerId = query.writerId

    const [articles, writerSettings] = await Promise.all([
      getPublishedArticles(db, { writerId, limit }),
      getWriterNewsletterSettings(db, writerId),
    ])

    const jsonFeed = {
      version: 'https://jsonfeed.org/version/1.1',
      title: writerSettings?.newsletterName || 'Blog',
      home_page_url: env.FRONTEND_URL,
      feed_url: `${env.FRONTEND_URL}/feeds/feed.json`,
      description: writerSettings
        ? `Latest posts from ${writerSettings.newsletterName}`
        : 'Latest posts',
      icon: writerSettings?.logoUrl || undefined,
      authors: writerSettings ? [{ name: writerSettings.fromName }] : undefined,
      items: articles.map((doc: any) => ({
        id: `${env.FRONTEND_URL}/posts/${doc.slug || doc.id}`,
        url: `${env.FRONTEND_URL}/posts/${doc.slug || doc.id}`,
        title: doc.title || 'Untitled',
        content_text: doc.subtitle || doc.metaDescription || '',
        content_html: doc.markdown || undefined,
        summary: doc.subtitle || doc.metaDescription || undefined,
        image: doc.bannerImage || doc.ogImage || undefined,
        date_published: (doc.publishedDate || doc.createdAt)?.toISOString(),
        date_modified: doc.updatedAt?.toISOString(),
        authors: writerSettings ? [{ name: writerSettings.fromName }] : undefined,
      })),
    }

    return c.json(jsonFeed, 200, {
      'Content-Type': 'application/feed+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    })
  }
)

export { feedsRouter }
