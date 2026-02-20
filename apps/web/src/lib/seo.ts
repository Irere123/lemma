const SITE_NAME = 'Lemma'
const DEFAULT_DESCRIPTION =
  'Lemma is an open-source, developer-first, API-first platform for knowledge publishing and structured thought.'
const FALLBACK_SITE_URL = 'https://lemma.irere.dev'

type SeoInput = {
  canonicalPath?: string
  canonicalUrl?: string
  description?: string
  image?: string
  noIndex?: boolean
  title?: string
  type?: 'article' | 'website'
}

type SeoMetaTag =
  | { charSet: string }
  | { content: string; name: string }
  | { content: string; property: string }
  | { title: string }

type SeoLinkTag = {
  href: string
  rel: string
}

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function toAbsoluteUrl(pathOrUrl: string) {
  if (isAbsoluteUrl(pathOrUrl)) {
    return pathOrUrl
  }

  const appUrl = import.meta.env.VITE_PUBLIC_APP_URL ?? FALLBACK_SITE_URL
  const safeBaseUrl = (() => {
    try {
      return new URL(appUrl).origin
    } catch {
      return FALLBACK_SITE_URL
    }
  })()

  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return new URL(normalizedPath, safeBaseUrl).toString()
}

function toTitle(title?: string) {
  if (!title || title.trim().length === 0) {
    return SITE_NAME
  }
  if (title.includes(SITE_NAME)) {
    return title
  }
  return `${title} | ${SITE_NAME}`
}

function notEmpty<T>(value: T | null): value is T {
  return value !== null
}

export function buildSeoHead(input: SeoInput = {}) {
  const pageTitle = toTitle(input.title)
  const description = input.description ?? DEFAULT_DESCRIPTION
  const canonical =
    input.canonicalUrl ?? (input.canonicalPath ? toAbsoluteUrl(input.canonicalPath) : null)
  const image = input.image ? toAbsoluteUrl(input.image) : null
  const robots = input.noIndex ? 'noindex, nofollow' : 'index, follow'
  const socialType = input.type ?? 'website'
  const twitterCard = image ? 'summary_large_image' : 'summary'

  const meta: SeoMetaTag[] = [
    { title: pageTitle },
    { name: 'description', content: description },
    { name: 'robots', content: robots },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:title', content: pageTitle },
    { property: 'og:description', content: description },
    { property: 'og:type', content: socialType },
    canonical ? { property: 'og:url', content: canonical } : null,
    image ? { property: 'og:image', content: image } : null,
    { name: 'twitter:card', content: twitterCard },
    { name: 'twitter:title', content: pageTitle },
    { name: 'twitter:description', content: description },
    image ? { name: 'twitter:image', content: image } : null,
  ].filter(notEmpty)

  const links: SeoLinkTag[] = canonical ? [{ rel: 'canonical', href: canonical }] : []

  return { links, meta }
}

export function buildRootSeoHead() {
  const defaults = buildSeoHead({
    description: DEFAULT_DESCRIPTION,
    title: SITE_NAME,
  })
  const rootMeta = defaults.meta.filter((tag) => !('name' in tag && tag.name === 'robots'))

  return {
    links: defaults.links,
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ...rootMeta,
    ],
  }
}
