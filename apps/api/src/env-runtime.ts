import { type Environment, parseEnv } from './env'
import type { JobData } from './jobs/types'

export type QueueSendOptions = {
  delaySeconds?: number
  contentType?: 'json' | 'text' | 'bytes' | 'v8'
}

export type QueueBinding<T = unknown> = {
  send: (body: T, options?: QueueSendOptions) => Promise<void>
  sendBatch?: (
    messages: Array<{
      body: T
      contentType?: QueueSendOptions['contentType']
      delaySeconds?: number
    }>,
    options?: QueueSendOptions
  ) => Promise<void>
}

export type KVNamespaceBinding = {
  get: <T = string>(
    key: string,
    options?:
      | 'text'
      | 'json'
      | 'arrayBuffer'
      | 'stream'
      | { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }
  ) => Promise<T | null>
  put: (
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: { expirationTtl?: number }
  ) => Promise<void>
  delete: (key: string) => Promise<void>
}

export type R2BucketBinding = {
  put: (
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
    options?: {
      httpMetadata?: {
        contentType?: string
        contentLength?: number
      }
      customMetadata?: Record<string, string>
    }
  ) => Promise<unknown>
  delete: (key: string) => Promise<void>
}

export type CloudflareBindings = Partial<Environment> & {
  DB?: D1Database
  R2_BUCKET?: R2BucketBinding
  CACHE?: KVNamespaceBinding
  EMAIL_QUEUE?: QueueBinding<JobData>
  NEWSLETTER_QUEUE?: QueueBinding<JobData>
  ANALYTICS_QUEUE?: QueueBinding<JobData>
  SCHEDULED_QUEUE?: QueueBinding<JobData>
}

let runtimeBindings: CloudflareBindings = {}
let parsedEnv: Environment | null = null

const getProcessEnv = (): Record<string, string | undefined> => {
  const maybeProcess = (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> }
    }
  ).process

  return maybeProcess?.env ?? {}
}

const buildEnvInput = () => {
  const processEnv = getProcessEnv()
  const data: Record<string, unknown> = {
    ...processEnv,
    ...runtimeBindings,
  }

  return data
}

export function setRuntimeEnv(bindings?: CloudflareBindings): void {
  runtimeBindings = bindings ?? {}
  parsedEnv = null
}

export function getRuntimeBindings(): CloudflareBindings {
  return runtimeBindings
}

export function getEnv(): Environment {
  if (!parsedEnv) {
    parsedEnv = parseEnv(buildEnvInput())
  }

  return parsedEnv
}

export const env = new Proxy({} as Environment, {
  get(_target, prop: string | symbol) {
    if (typeof prop === 'symbol') {
      return undefined
    }

    return getEnv()[prop as keyof Environment]
  },
})
