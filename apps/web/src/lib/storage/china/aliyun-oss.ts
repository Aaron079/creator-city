import { ChinaStorageError } from './errors'
import OSS from 'ali-oss'
import type {
  ChinaStorageConfiguration,
  ChinaStorageObjectResult,
  ChinaStorageSignedUrlResult,
  PutChinaObjectInput,
  SignedChinaObjectInput,
} from './types'

const REQUIRED = [
  'ALIYUN_ACCESS_KEY_ID',
  'ALIYUN_ACCESS_KEY_SECRET',
  'ALIYUN_OSS_BUCKET',
  'ALIYUN_OSS_REGION',
  'ALIYUN_OSS_ENDPOINT',
] as const

export function getAliyunOssConfiguration(): ChinaStorageConfiguration {
  const missing = REQUIRED.filter((key) => !process.env[key])
  return {
    provider: 'aliyun-oss',
    configured: missing.length === 0,
    missing,
    mode: missing.length === 0 ? 'ready' : 'not-configured',
    bucket: process.env.ALIYUN_OSS_BUCKET,
    region: process.env.ALIYUN_OSS_REGION,
  }
}

function requireAliyunOss() {
  const config = getAliyunOssConfiguration()
  if (!config.configured) {
    throw new ChinaStorageError('STORAGE_NOT_CONFIGURED', '阿里云 OSS 参数未配置。', 503, {
      provider: 'aliyun-oss',
      missing: config.missing,
    })
  }
}

function getAliyunClient() {
  requireAliyunOss()
  return new OSS({
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET!,
    bucket: process.env.ALIYUN_OSS_BUCKET!,
    region: process.env.ALIYUN_OSS_REGION!,
    endpoint: process.env.ALIYUN_OSS_ENDPOINT,
  })
}

function getSizeBytes(body: PutChinaObjectInput['body']) {
  if (typeof body === 'string') return Buffer.byteLength(body)
  if (body instanceof ArrayBuffer) return body.byteLength
  return body.byteLength
}

function normalizeBody(body: PutChinaObjectInput['body']) {
  if (body instanceof ArrayBuffer) return Buffer.from(body)
  return body
}

function buildPublicUrl(key: string, fallback?: string) {
  const baseUrl = process.env.ALIYUN_OSS_PUBLIC_BASE_URL?.trim()
  if (!baseUrl) return fallback
  return `${baseUrl.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`
}

export async function putAliyunOssObject(input: PutChinaObjectInput): Promise<ChinaStorageObjectResult> {
  const client = getAliyunClient()
  try {
    const result = await client.put(input.key, normalizeBody(input.body), {
      headers: {
        ...(input.contentType ? { 'Content-Type': input.contentType } : {}),
        ...(input.metadata
          ? Object.fromEntries(Object.entries(input.metadata).map(([key, value]) => [`x-oss-meta-${key}`, value]))
          : {}),
      },
    })
    const url = typeof result.url === 'string' ? result.url : undefined
    return {
      provider: 'aliyun-oss',
      bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
      key: input.key,
      url,
      publicUrl: buildPublicUrl(input.key, url),
      sizeBytes: getSizeBytes(input.body),
      contentType: input.contentType,
      raw: {
        requestId: result.res?.headers && typeof result.res.headers === 'object'
          ? (result.res.headers as Record<string, unknown>)['x-oss-request-id']
          : undefined,
      },
    }
  } catch (error) {
    throw new ChinaStorageError(
      'STORAGE_OPERATION_FAILED',
      error instanceof Error ? error.message : '阿里云 OSS 上传失败。',
      502,
      { provider: 'aliyun-oss' },
    )
  }
}

export async function getAliyunOssSignedUploadUrl(input: SignedChinaObjectInput): Promise<ChinaStorageSignedUrlResult> {
  requireAliyunOss()
  return {
    provider: 'aliyun-oss',
    bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
    key: input.key,
    raw: { mode: 'stub', expiresInSeconds: input.expiresInSeconds },
  }
}

export async function getAliyunOssSignedDownloadUrl(input: SignedChinaObjectInput): Promise<ChinaStorageSignedUrlResult> {
  requireAliyunOss()
  return {
    provider: 'aliyun-oss',
    bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
    key: input.key,
    raw: { mode: 'stub', expiresInSeconds: input.expiresInSeconds },
  }
}

export async function deleteAliyunOssObject(key: string): Promise<ChinaStorageObjectResult> {
  requireAliyunOss()
  return {
    provider: 'aliyun-oss',
    bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
    key,
    raw: { mode: 'stub' },
  }
}
