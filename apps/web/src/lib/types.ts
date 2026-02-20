export interface IPost {
  id: string
  title: string
  slug: string
  subtitle: string
  markdown?: string | null
  createdAt: string
  publishedDate: string
  updatedAt: string
}
