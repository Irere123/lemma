export interface DocumentData {
  id: string
  title: string | null
  subtitle: string | null
  markdown: string | null
  // Pre-rendered, email-safe HTML built from the canonical Tiptap JSON
  // (@lemma/content renderToEmail). Preferred over markdown when present.
  bodyHtml?: string | null
  bannerImage: string | null
  publishedDate: Date | null
  scheduledDate: Date | null
}

export interface NewsletterSettings {
  id: string
  fromName: string
  newsletterName: string
  logoUrl: string | null
  brandColor: string
  baseUrl: string
  confirmationUrl?: string
}

export interface AuthorInfo {
  name: string
  publication: string
}
