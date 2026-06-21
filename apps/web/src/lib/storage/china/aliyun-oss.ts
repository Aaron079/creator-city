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
  { name: 'ALIYUN_OSS_ACCESS_KEY_ID', aliases: ['ALIYUN_OSS_ACCESS_KEY_ID', 'ALIYUN_ACCESS_KEY_ID'] },
  { name: 'ALIYUN_OSS_ACCESS_KEY_SECRET', aliases: ['ALIYUN_OSS_ACCESS_KEY_SECRET', 'ALIYUN_ACCESS_KEY_SECRET'] },
  { name: 'ALIYUN_OSS_BUCKET', aliases: ['ALIYUN_OSS_BUCKET'] },
  { name: 'ALIYUN_OSS_REGION', aliases: ['ALIYUN_OSS_REGION'] },
  { name: 'ALIYUN_OSS_ENDPOINT', aliases: ['ALIYUN_OSS_ENDPOINT'] },
] as const

const DEFAULT_ALIYUN_OSS_TIMEOUT_MS = 120_000
const ALIYUN_OSS_UPLOAD_RETRIES = 2

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim())
}

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ''
}

function numericEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function missingRequiredAliyunEnv() {
  return REQUIRED
    .filter((entry) => !entry.aliases.some(hasEnv))
    .map((entry) => entry.name)
}

export function getAliyunOssConfiguration(): ChinaStorageConfiguration {
  const missing = missingRequiredAliyunEnv()
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
    accessKeyId: envValue('ALIYUN_OSS_ACCESS_KEY_ID', 'ALIYUN_ACCESS_KEY_ID'),
    accessKeySecret: envValue('ALIYUN_OSS_ACCESS_KEY_SECRET', 'ALIYUN_ACCESS_KEY_SECRET'),
    bucket: process.env.ALIYUN_OSS_BUCKET!,
    region: process.env.ALIYUN_OSS_REGION!,
    endpoint: process.env.ALIYUN_OSS_ENDPOINT,
    timeout: numericEnv('ALIYUN_OSS_TIMEOUT_MS', DEFAULT_ALIYUN_OSS_TIMEOUT_MS),
  })
}

// Signing client uses the public region endpoint so generated URLs are browser-accessible.
// ALIYUN_OSS_ENDPOINT may be an internal endpoint (for server-to-server uploads);
// signed download URLs must always use the public internet endpoint.
function getAliyunSigningClient() {
  requireAliyunOss()
  return new OSS({
    accessKeyId: envValue('ALIYUN_OSS_ACCESS_KEY_ID', 'ALIYUN_ACCESS_KEY_ID'),
    accessKeySecret: envValue('ALIYUN_OSS_ACCESS_KEY_SECRET', 'ALIYUN_ACCESS_KEY_SECRET'),
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
  const response = record.response && typeof record.response === 'object' ? record.response as Record<string, unknown> : {}
  const headers = record.headers ?? response.headers
  const status = typeof record.status === 'number'
    ? record.status
    : typeof record.statusCode === 'number'
      ? record.statusCode
      : undefined
  const name = error instanceof Error ? error.name : typeof record.name === 'string' ? record.name : undefined
  const message = error instanceof Error ? error.message : typeof record.message === 'string' ? record.message : undefined
  const code = typeof record.code === 'string' ? record.code : undefined
  const requestId = typeof record.requestId === 'string'
    ? record.requestId
    : typeof record.requestid === 'string'
      ? record.requestid
      : headerValue(headers, 'x-oss-request-id')
  const cause = record.cause && typeof record.cause === 'object' ? record.cause as Record<string, unknown> : {}
  return {
    status,
    code,
    name,
    message,
    requestId,
    ossRequestId: requestId,
    causeName: typeof cause.name === 'string' ? cause.name : undefined,
    causeCode: typeof cause.code === 'string' ? cause.code : undefined,
    causeMessage: typeof cause.message === 'string' ? cause.message : undefined,
  }
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

function classifyAliyunError(error: unknown) {
  const details = objectErrorDetails(error)
  const haystack = [
    details.name,
    details.code,
    details.message,
    details.causeName,
    details.causeCode,
    details.causeMessage,
  ].filter(Boolean).join(' ').toLowerCase()
  if (/responsetimeouterror|timeout|timedout|etimedout|socket timeout/.test(haystack)) {
    return { code: 'STORAGE_UPLOAD_TIMEOUT' as const, status: 504, message: 'Aliyun OSS upload timed out' }
  }
  if (/nosuchbucket|invalidbucket|invalid endpoint|unknown endpoint|enotfound|getaddrinfo|storage_not_configured|not configured/.test(haystack)) {
    return { code: 'STORAGE_CONFIG_ERROR' as const, status: details.status ?? 503, message: details.message || 'Aliyun OSS configuration is invalid.' }
  }
  if (/invalidaccesskeyid|signaturedoesnotmatch|invalidsecuritytoken|accesskey|credentials?|credential/.test(haystack)) {
    return { code: 'STORAGE_AUTH_FAILED' as const, status: details.status ?? 401, message: details.message || 'Aliyun OSS authentication failed.' }
  }
  if (details.status === 401 || details.status === 403 || /accessdenied|forbidden|permission|not authorized/.test(haystack)) {
    return { code: 'STORAGE_PERMISSION_DENIED' as const, status: details.status ?? 403, message: details.message || 'Aliyun OSS permission denied.' }
  }
  return { code: 'STORAGE_OPERATION_FAILED' as const, status: details.status ?? 502, message: details.message || 'Aliyun OSS upload failed.' }
}

function shouldRetryAliyunUpload(error: unknown) {
  const details = objectErrorDetails(error)
  const haystack = [
    details.name,
    details.code,
    details.message,
    details.causeName,
    details.causeCode,
    details.causeMessage,
  ].filter(Boolean).join(' ').toLowerCase()
  if (/responsetimeouterror|timeout|timedout|etimedout|econnreset|eai_again|socket hang up/.test(haystack)) return true
  return typeof details.status === 'number' && details.status >= 500
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function putAliyunOssObject(input: PutChinaObjectInput): Promise<ChinaStorageObjectResult> {
  const timeout = numericEnv('ALIYUN_OSS_UPLOAD_TIMEOUT_MS', numericEnv('ALIYUN_OSS_TIMEOUT_MS', DEFAULT_ALIYUN_OSS_TIMEOUT_MS))
  let attempt = 0
  try {
    const client = getAliyunClient()
    let result: Awaited<ReturnType<typeof client.put>> | null = null
    for (;;) {
      attempt += 1
      try {
        result = await client.put(input.key, normalizeBody(input.body), {
          timeout,
          headers: {
            ...(input.contentType ? { 'Content-Type': input.contentType } : {}),
            ...(input.metadata
              ? Object.fromEntries(Object.entries(input.metadata).map(([key, value]) => [`x-oss-meta-${key}`, value]))
              : {}),
          },
        })
        break
      } catch (error) {
        if (attempt <= ALIYUN_OSS_UPLOAD_RETRIES && shouldRetryAliyunUpload(error)) {
          await delay(350 * attempt)
          continue
        }
        throw error
      }
    }
    if (!result) throw new Error('Aliyun OSS upload did not return a result.')
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
        timeout,
        attempts: attempt,
      },
    }
  } catch (error) {
    const details = objectErrorDetails(error)
    const classified = classifyAliyunError(error)
    throw new ChinaStorageError(
      classified.code,
      classified.message,
      classified.status,
      {
        provider: 'aliyun-oss',
        bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
        key: input.key,
        operation: 'putObject',
        timeout,
        attempts: attempt,
        ...details,
      },
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
  const expiresInSeconds = input.expiresInSeconds ?? 900
  const publicUrl = buildPublicUrl(input.key)
  try {
    // Generate a real HMAC-SHA1 presigned PUT URL using OSS AccessKey credentials.
    // The signed URL allows a single PUT to the exact key for `expiresInSeconds` seconds.
    // Content-Type is included in the signature so the worker must send a matching header.
    const signingClient = getAliyunSigningClient()
    const signedUrl = signingClient.signatureUrl(input.key, {
      expires: expiresInSeconds,
      method: 'PUT',
      'Content-Type': input.contentType ?? 'image/png',
    })
    return {
      provider: 'aliyun-oss',
      bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
      key: input.key,
      signedUrl,
      publicUrl: publicUrl ?? signedUrl,
      url: signedUrl,
      raw: { mode: 'signed-put', expiresInSeconds },
    }
  } catch {
    // Fallback: credentials not available in this environment (e.g. local dev without OSS env).
    // Returns a stub so dependent code can handle gracefully.
    return {
      provider: 'aliyun-oss',
      bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
      key: input.key,
      ...(publicUrl ? { publicUrl, url: publicUrl } : {}),
      raw: { mode: publicUrl ? 'public-fallback' : 'stub', expiresInSeconds },
    }
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
  const client = getAliyunClient()
  try {
    const result = await client.delete(key)
    const headers = result.res?.headers
    return {
      provider: 'aliyun-oss',
      bucket: process.env.ALIYUN_OSS_BUCKET ?? '',
      key,
      raw: {
        requestId: headerValue(headers, 'x-oss-request-id'),
        status: result.res?.status,
      },
    }
  } catch (error) {
    const details = objectErrorDetails(error)
    throw new ChinaStorageError(
      'STORAGE_OPERATION_FAILED',
      error instanceof Error ? error.message : '阿里云 OSS 对象删除失败。',
      details.status ?? 502,
      { provider: 'aliyun-oss', key, ...details },
    )
  }
}
