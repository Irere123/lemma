import { client } from './client'

type GetPreSignedUrlParams = {
  fileSize: number
  contentType: string
  filename: string
}

type GetPreSignedUrlResponse = {
  preSignedUrl: string
  filename: string
  fileSize: number
  contentType: string
  expiresIn: number
  originalFilename: string
  uploadedBy: string
  uploadedAt: string
}

type DirectUploadResponse = {
  url: string
  key: string
  filename: string
  originalFilename: string
  contentType: string
  fileSize: number
  uploadedBy: string
  uploadedAt: string
}

type DeleteUploadedFileParams = {
  key?: string
  fileUrl?: string
}

type DeleteUploadedFileResponse = {
  success: boolean
  key: string
}

export const getPreSignedUrl = async (
  params: GetPreSignedUrlParams
): Promise<GetPreSignedUrlResponse> => {
  const response = await client.post('/uploads/pre-signed-url', params, {
    withCredentials: true,
  })
  return response.data
}

export const uploadFile = async (file: File): Promise<DirectUploadResponse> => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await client.post('/uploads', formData, {
    withCredentials: true,
  })

  return response.data
}

export const deleteUploadedFile = async (
  params: DeleteUploadedFileParams
): Promise<DeleteUploadedFileResponse> => {
  const response = await client.post('/uploads/delete', params, {
    withCredentials: true,
  })

  return response.data
}
