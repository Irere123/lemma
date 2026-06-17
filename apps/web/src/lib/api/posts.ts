import { client } from './client'
import type { IPost } from '../types'

export const getPostBySlug = async (slug: string): Promise<IPost> => {
  const response = await client.get(`/posts/slug/${slug}`)
  return response.data
}

export const getPublishedPosts = async (writerId?: string): Promise<{ data: IPost[] }> => {
  const response = await client.get('/posts', {
    params: writerId ? { writerId } : undefined,
  })
  return response.data
}
