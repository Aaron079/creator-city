import { ChinaStorageError } from './errors'
import OSS from 'ali-oss'
import type {
  ChinaStorageConfiguration,
  ChinaStorageObjectMetadataResult,
  ChinaStorageReadObjectResult,
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

// Signing client uses the public region endpoint so generated URLs are browser-accessible.
// ALIYUN_OSS_ENDPOINT may be an internal endpoint (for server-to-server uploads);
// signed download URLs must always use the public internet endpoint.
function getAliyunSigningClient() {
  requireAliyunOss()
  return new OSS({
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID!,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET!,
    bucket: process.env.ALIYUN_OSS_BUCKET!,
    region: process.env.ALIYUN_OSS_REGION!,
    // No custom endpoint — falls back to public oss-{region}.aliyuncs.com
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

function headerValue(headers: unknown, key: string) {
  if (!headers || typeof headers !== 'object') return undefined
  const record = headers as Record<string, unknown>
  const direct = record[key] ?? record[key.toLowerCase()]
  return typeof direct === 'string' ? direct : undefined
}

function objectErrorDetails(error: unknown) {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const status = typeof record.status === 'number'
    ? record.status
    : typeof record.statusCode === 'number'
      ? record.statusCode
      : undefined
  const code = typeof record.code === 'string' ? record.code : undefined
  const requestId = typeof record.requestId === 'string'
    ? record.requestId
    : typeof record.requestid === 'string'
      ? record.requestid
      : undefined
  return { status, code, requestId }
}

function bufferFromObjectContent(content: unknown) {
  if (Buffer.isBuffer(content)) return content
  if (content instanceof ArrayBuffer) return Buffer.from(content)
  if (content instanceof Uint8Array) return Buffer.from(content.buffer, content.byteOffset, content.byteLength)
  if (typeof content === 'string') return Buffer.from(content)
  return Buffer.alloc(0)
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

export async function headAliyunOssObject(key: string): Promise<ChinaStorageObjectMetadataResult> {
  const client = getAliyunClient()
  try {
    const result = await client.head(key)
    const headers = result.res?.headers
    const contentLength = Number(headerValue(headers, 'content-length') || 0)
    return {
      provider: 'aliyun-oss',
      bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
      key,
      publicUrl: buildPublicUrl(key),
      sizeBytes: Number.isFinite(contentLength) && contentLength > 0 ? contentLength : undefined,
      contentType: headerValue(headers, 'content-type'),
      raw: {
        requestId: headerValue(headers, 'x-oss-request-id'),
        status: result.res?.status,
      },
    }
  } catch (error) {
    const details = objectErrorDetails(error)
    throw new ChinaStorageError(
      'STORAGE_OPERATION_FAILED',
      error instanceof Error ? error.message : '阿里云 OSS 对象检查失败。',
      details.status ?? 502,
      { provider: 'aliyun-oss', key, ...details },
    )
  }
}

export async function getAliyunOssObject(key: string): Promise<ChinaStorageReadObjectResult> {
  const client = getAliyunClient()
  try {
    const result = await client.get(key)
    const headers = result.res?.headers
    const body = bufferFromObjectContent(result.content)
    const contentLength = Number(headerValue(headers, 'content-length') || body.byteLength)
    return {
      provider: 'aliyun-oss',
      bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
      key,
      publicUrl: buildPublicUrl(key),
      body,
      sizeBytes: Number.isFinite(contentLength) && contentLength > 0 ? contentLength : body.byteLength,
      contentType: headerValue(headers, 'content-type') || 'application/octet-stream',
      raw: {
        requestId: headerValue(headers, 'x-oss-request-id'),
        status: result.res?.status,
      },
    }
  } catch (error) {
    const details = objectErrorDetails(error)
    throw new ChinaStorageError(
      'STORAGE_OPERATION_FAILED',
      error instanceof Error ? error.message : '阿里云 OSS 对象读取失败。',
      details.status ?? 502,
      { provider: 'aliyun-oss', key, ...details },
    )
  }
}

export async function getAliyunOssSignedUploadUrl(input: SignedChinaObjectInput): Promise<ChinaStorageSignedUrlResult> {
  requireAliyunOss()
  const publicUrl = buildPublicUrl(input.key)
  return {
    provider: 'aliyun-oss',
    bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
    key: input.key,
    ...(publicUrl ? { publicUrl, url: publicUrl } : {}),
    raw: { mode: publicUrl ? 'public' : 'stub', expiresInSeconds: input.expiresInSeconds },
  }
}

export async function getAliyunOssSignedDownloadUrl(input: SignedChinaObjectInput): Promise<ChinaStorageSignedUrlResult> {
  requireAliyunOss()
  const publicUrl = buildPublicUrl(input.key)
  const expiresInSeconds = input.expiresInSeconds || 3600
  try {
    // Generate a real pre-signed URL using OSS AccessKey credentials.
    // This works for private buckets — the signature allows read access without exposing keys.
    const signingClient = getAliyunSigningClient()
    const signedUrl = signingClient.signatureUrl(input.key, {
      expires: expiresInSeconds,
      method: 'GET',
    })
    return {
      provider: 'aliyun-oss',
      bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
      key: input.key,
      signedUrl,
      publicUrl: publicUrl ?? signedUrl,
      url: signedUrl,
      raw: { mode: 'signed', expiresInSeconds },
    }
  } catch {
    // Fallback: if signing fails (e.g., missing key), use publicUrl if available.
    return {
      provider: 'aliyun-oss',
      bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
      key: input.key,
      ...(publicUrl ? { signedUrl: publicUrl, publicUrl, url: publicUrl } : {}),
      raw: { mode: publicUrl ? 'public-fallback' : 'stub', expiresInSeconds },
    }
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
