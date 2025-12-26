import { client } from './client'
import type { IPost } from '../types'

export const getPostBySlug = async (slug: string): Promise<IPost> => {
  const response = await client.get(`/posts/slug/${slug}`)
  return response.data
}

export const getAdminArticles = async (): Promise<{ data: IPost[] }> => {
  const response = await client.get('/posts/admin/articles')
  return response.data
}
