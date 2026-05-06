export type ChinaStorageProvider = 'aliyun-oss' | 'tencent-cos'

export type ChinaStorageObjectInput = {
  key: string
  contentType?: string
  metadata?: Record<string, string>
}

export type PutChinaObjectInput = ChinaStorageObjectInput & {
  body: ArrayBuffer | Buffer | Uint8Array | string
}

export type SignedChinaObjectInput = ChinaStorageObjectInput & {
  expiresInSeconds?: number
}

export type ChinaStorageObjectResult = {
  provider: ChinaStorageProvider
  bucket: string
  key: string
  url?: string
  publicUrl?: string
  sizeBytes?: number
  contentType?: string
  raw?: unknown
}

export type ChinaStorageSignedUrlResult = ChinaStorageObjectResult & {
  signedUrl?: string
  expiresAt?: string
}

export type ChinaStorageConfiguration = {
  provider: ChinaStorageProvider
  configured: boolean
  missing: string[]
  mode: 'not-configured' | 'stub' | 'ready' | 'not-implemented'
  bucket?: string
  region?: string
}
