import { AwsClient } from 'aws4fetch'

import { env, getRuntimeBindings } from '@api/env-runtime'
import { fetchWithTimeout } from '@api/utils'

interface imageOptions {
  contentType?: string
  width?: number
  height?: number
  headers?: Record<string, string>
}

type SignedUrlMethod = 'PUT' | 'GET'

type SignedUrlOptions = {
  key: string
  method: SignedUrlMethod
  expiresIn?: number
  headers?: Record<string, string>
}

type SignedUrlResult = {
  url: string
  expiresIn: number
  headers: Record<string, string>
}

class StorageClient {
  private createAwsClient() {
    return new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: env.R2_SECRET_ACCESS_KEY || '',
      service: 's3',
      region: 'auto',
    })
  }

  async upload(key: string, body: Blob | Buffer | string, opts?: imageOptions) {
    let uploadBody: any
    if (typeof body === 'string') {
      if (this.isBase64(body)) {
        uploadBody = this.base64ToArrayBuffer(body, opts)
      } else if (this.isUrl(body)) {
        uploadBody = await this.urlToBlob(body, opts)
      } else {
        throw new Error('Invalid input: Not a base64 string or a valid URL')
      }
    } else {
      uploadBody = body
    }

    const headers: Record<string, string> = {
      ...opts?.headers,
    }

    const contentLength = this.getBodySize(uploadBody)

    if (typeof contentLength === 'number') {
      headers['Content-Length'] = contentLength.toString()
    }

    if (opts?.contentType) {
      headers['Content-Type'] = opts.contentType
    }

    try {
      const bucket = getRuntimeBindings().R2_BUCKET

      if (bucket) {
        await bucket.put(key, uploadBody, {
          httpMetadata: {
            contentType: opts?.contentType,
            contentLength,
          },
        })
      } else {
        await this.createAwsClient().fetch(`${env.R2_BUCKET_URL}/${key}`, {
          method: 'PUT',
          headers,
          body: uploadBody,
        })
      }

      return {
        url: `${env.R2_STORAGE_BASE_URL}/${key}`,
      }
    } catch (error: any) {
      throw new Error(`Failed to upload file: ${error.message}`)
    }
  }

  async delete(key: string) {
    const bucket = getRuntimeBindings().R2_BUCKET

    if (bucket) {
      await bucket.delete(key)
    } else {
      await this.createAwsClient().fetch(`${env.R2_BUCKET_URL}/${key}`, {
        method: 'DELETE',
      })
    }

    return { success: true }
  }

  async getSignedUrl({
    key,
    method,
    expiresIn,
    headers = {},
  }: SignedUrlOptions): Promise<SignedUrlResult> {
    const url = new URL(`${env.R2_BUCKET_URL}/${key}`)

    const ttl = expiresIn ?? 600

    url.searchParams.set('X-Amz-Expires', String(ttl))

    try {
      const response = await this.createAwsClient().sign(url, {
        method,
        headers,
        aws: {
          signQuery: true,
          allHeaders: true,
        },
      })

      return {
        url: response.url,
        expiresIn: ttl,
        headers,
      }
    } catch (error) {
      console.error('storage.getSignedUrl failed', error)
      throw new Error('Failed to generate signed url. Please try again later.')
    }
  }

  async getSignedUploadUrl(opts: {
    key: string

    expiresIn?: number
    contentType?: string
    headers?: Record<string, string>
  }) {
    const headers: Record<string, string> = {
      ...opts.headers,
    }

    if (opts.contentType) {
      headers['Content-Type'] = opts.contentType
    }

    return await this.getSignedUrl({
      key: opts.key,
      method: 'PUT',
      headers,
      expiresIn: opts.expiresIn,
    })
  }

  async getSignedDownloadUrl(opts: { key: string; expiresIn?: number }) {
    return await this.getSignedUrl({
      key: opts.key,
      method: 'GET',
      expiresIn: opts.expiresIn,
    })
  }

  private getBodySize(
    body: Blob | ArrayBuffer | ArrayBufferView | string | { [key: string]: unknown }
  ) {
    if (typeof body === 'string') {
      const bufferCtor = (
        globalThis as unknown as {
          Buffer?: { byteLength?(input: string): number }
        }
      ).Buffer

      if (bufferCtor?.byteLength) {
        return bufferCtor.byteLength(body)
      }

      return new TextEncoder().encode(body).byteLength
    }

    if (typeof Blob !== 'undefined' && body instanceof Blob) {
      return body.size
    }

    if (body instanceof ArrayBuffer) {
      return body.byteLength
    }

    if (ArrayBuffer.isView(body)) {
      return body.byteLength
    }

    if (body && typeof body === 'object') {
      const candidate = body as {
        size?: unknown
        length?: unknown
        byteLength?: unknown
      }

      if (typeof candidate.size === 'number') {
        return candidate.size
      }

      if (typeof candidate.byteLength === 'number') {
        return candidate.byteLength
      }

      if (typeof candidate.length === 'number') {
        return candidate.length
      }
    }

    return undefined
  }

  private base64ToArrayBuffer(base64: string, opts?: imageOptions) {
    const base64Data = base64.replace(/^data:.+;base64,/, '')
    const paddedBase64Data = base64Data.padEnd(
      base64Data.length + ((4 - (base64Data.length % 4)) % 4),
      '='
    )

    const binaryString = atob(paddedBase64Data)
    const byteArray = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      byteArray[i] = binaryString.charCodeAt(i)
    }
    const blobProps: { type?: string } = {}
    if (opts?.contentType) blobProps.type = opts.contentType
    return new Blob([byteArray], blobProps)
  }

  private isBase64(str: string) {
    const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

    const dataImageRegex =
      /^data:image\/[a-zA-Z0-9.+-]+;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

    return base64Regex.test(str) || dataImageRegex.test(str)
  }

  private isUrl(str: string): boolean {
    try {
      new URL(str)
      return true
    } catch (_) {
      return false
    }
  }

  private async urlToBlob(url: string, opts?: imageOptions): Promise<Blob> {
    let response: Response
    if (opts?.height || opts?.width) {
      try {
        const proxyUrl = new URL('https://wsrv.nl')
        proxyUrl.searchParams.set('url', url)
        if (opts.width) proxyUrl.searchParams.set('w', opts.width.toString())
        if (opts.height) proxyUrl.searchParams.set('h', opts.height.toString())
        proxyUrl.searchParams.set('fit', 'cover')
        response = await fetchWithTimeout(new URL(proxyUrl.toString()))
      } catch (error) {
        response = await fetch(url)
      }
    } else {
      response = await fetch(url)
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`)
    }
    const blob = await response.blob()
    if (opts?.contentType) {
      return new Blob([blob], { type: opts.contentType })
    }
    return blob
  }
}

export const storage = new StorageClient()
