import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { getChinaObject, getConfiguredChinaStorageProvider, getSignedDownloadUrl, headChinaObject, isChinaStorageConfigured, putChinaObject } from '@/lib/storage/china/gateway'
import { isChinaStorageError } from '@/lib/storage/china/errors'

export type CanonicalStorageProvider = 'supabase' | 'vercel_blob' | 's3' | 'local_dev' | 'aliyun-oss' | 'tencent-cos' | 'external'

export type UploadAssetInput = {
  filename?: string
  mimeType?: string
  projectId?: string | null
  userId?: string | null
  type: string
}

export type UploadedAssetObject = {
  storageProvider: CanonicalStorageProvider
  bucket?: string | null
  storageKey?: string | null
  url: string
  size: number
  mimeType: string
}

export type ResolvedAssetUrl = {
  url: string
  expiresAt?: string
  source: 'storageKey' | 'url' | 'dataUrl' | 'missing'
  signedUrlAvailable?: boolean
  errorCode?: string
  message?: string
}

export type ObjectExistsResult = {
  exists: boolean
  status: number
  storageProvider?: CanonicalStorageProvider | null
  bucket?: string | null
  storageKey?: string | null
  message?: string
}

export type AssetUrlLike = {
  id?: string
  url?: string | null
  dataUrl?: string | null
  storageProvider?: string | null
  bucket?: string | null
  storageKey?: string | null
  metadataJson?: unknown
  metadata?: unknown
}

export type DownloadExternalAssetResult =
  | {
      ok: true
      buffer: Buffer
      mimeType: string
      size: number
      status: number
    }
  | {
      ok: false
      status: number
      errorCode: string
      message: string
      bodySnippet?: string
    }

export type ReadStoredAssetObjectResult =
  | {
      ok: true
      buffer: Buffer
      mimeType: string
      size: number
      status: number
      storageProvider: CanonicalStorageProvider
      bucket?: string | null
      storageKey: string
    }
  | {
      ok: false
      status: number
      errorCode: 'object_missing' | 'storage_permission_error' | 'signing_error' | 'proxy_error'
      message: string
      storageProvider?: CanonicalStorageProvider | null
      bucket?: string | null
      storageKey?: string | null
    }

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function storageKeyFromMetadata(asset: AssetUrlLike) {
  const metadata = recordValue(asset.metadataJson) || recordValue(asset.metadata)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return stringValue(asset.storageKey)
    || stringValue(metadata.storageKey)
    || stringValue(metadata.key)
    || stringValue(recordValue(metadata.storage).key)
    || stringValue(mediaPersistence.storageKey)
    || stringValue(mediaPersistence.key)
}

function storageProviderFromMetadata(asset: AssetUrlLike): CanonicalStorageProvider | '' {
  const metadata = recordValue(asset.metadataJson) || recordValue(asset.metadata)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  const provider = stringValue(asset.storageProvider)
    || stringValue(metadata.storageProvider)
    || stringValue(recordValue(metadata.storage).provider)
    || stringValue(mediaPersistence.storageProvider)
    || stringValue(mediaPersistence.provider)
  if (provider === 'aliyun-oss' || provider === 'tencent-cos' || provider === 'supabase' || provider === 'vercel_blob' || provider === 's3' || provider === 'local_dev' || provider === 'external') return provider
  return ''
}

function bucketFromMetadata(asset: AssetUrlLike) {
  const metadata = recordValue(asset.metadataJson) || recordValue(asset.metadata)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return stringValue(asset.bucket)
    || stringValue(metadata.bucket)
    || stringValue(metadata.storageBucket)
    || stringValue(recordValue(metadata.storage).bucket)
    || stringValue(mediaPersistence.bucket)
}

function normalizedStorageReadError(args: {
  error: unknown
  provider?: CanonicalStorageProvider | null
  bucket?: string | null
  storageKey?: string | null
  fallbackMessage: string
}): Extract<ReadStoredAssetObjectResult, { ok: false }> {
  const { error, provider, bucket, storageKey, fallbackMessage } = args
  const message = error instanceof Error ? error.message : fallbackMessage
  const status = isChinaStorageError(error)
    ? error.status
    : typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : 0
  const details = isChinaStorageError(error) && error.details && typeof error.details === 'object'
    ? error.details as Record<string, unknown>
    : {}
  const codeText = `${isChinaStorageError(error) ? error.code : ''} ${String(details.code ?? '')} ${message}`.toLowerCase()
  const errorCode: Extract<ReadStoredAssetObjectResult, { ok: false }>['errorCode'] =
    status === 404 || /no such key|nosuchkey|not found|missing|404/.test(codeText)
      ? 'object_missing'
      : status === 401 || status === 403 || /accessdenied|forbidden|permission|signature|unauthori/.test(codeText)
        ? 'storage_permission_error'
        : /not configured|credential|access_key|secret|storage_not_configured/.test(codeText)
          ? 'signing_error'
          : 'proxy_error'
  return {
    ok: false,
    status,
    errorCode,
    message,
    storageProvider: provider,
    bucket,
    storageKey,
  }
}

function safeFileName(name: string) {
  const clean = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return clean.slice(0, 120) || 'asset.bin'
}

function defaultExtension(mimeType: string, type: string) {
  if (mimeType.includes('jpeg')) return 'jpg'
  if (mimeType.includes('webp')) return 'webp'
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('gif')) return 'gif'
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('quicktime')) return 'mov'
  if (mimeType.includes('mpeg')) return 'mp3'
  if (type === 'image') return 'png'
  if (type === 'video') return 'mp4'
  return 'bin'
}

function buildStorageKey(input: UploadAssetInput, mimeType: string) {
  const now = new Date()
  const assetId = randomUUID()
  const owner = input.userId || 'anonymous'
  const year = String(now.getUTCFullYear())
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const filename = safeFileName(input.filename || `${input.type}-${assetId}.${defaultExtension(mimeType, input.type)}`)
  return `assets/${owner}/${year}/${month}/${assetId}-${filename}`
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || process.env.SUPABASE_ASSETS_BUCKET || 'creator-city-assets'
  return {
    configured: Boolean(url && serviceRoleKey && bucket),
    url: url?.replace(/\/+$/, ''),
    serviceRoleKey,
    bucket,
  }
}

async function uploadSupabaseObject(buffer: Buffer, input: UploadAssetInput, mimeType: string): Promise<UploadedAssetObject> {
  const config = supabaseConfig()
  if (!config.configured || !config.url || !config.serviceRoleKey) {
    throw new Error('Supabase Storage is not configured.')
  }
  const storageKey = buildStorageKey(input, mimeType)
  const response = await fetch(`${config.url}/storage/v1/object/${config.bucket}/${storageKey}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      'Content-Type': mimeType,
      'x-upsert': 'false',
    },
    body: new Uint8Array(buffer),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Supabase upload failed (${response.status}): ${text.slice(0, 300)}`)
  }
  const url = process.env.SUPABASE_STORAGE_PUBLIC === 'true'
    ? `${config.url}/storage/v1/object/public/${config.bucket}/${storageKey}`
    : `storage://supabase/${config.bucket}/${storageKey}`
  return {
    storageProvider: 'supabase',
    bucket: config.bucket,
    storageKey,
    url,
    size: buffer.byteLength,
    mimeType,
  }
}

async function uploadChinaObject(buffer: Buffer, input: UploadAssetInput, mimeType: string): Promise<UploadedAssetObject> {
  const provider = getConfiguredChinaStorageProvider()
  const storageKey = buildStorageKey(input, mimeType)
  const uploaded = await putChinaObject({
    provider,
    key: storageKey,
    body: buffer,
    contentType: mimeType,
    metadata: {
      ownerId: input.userId || '',
      projectId: input.projectId || '',
      source: 'creator-city-asset',
    },
  })
  return {
    storageProvider: uploaded.provider,
    bucket: uploaded.bucket,
    storageKey: uploaded.key,
    url: uploaded.publicUrl ?? uploaded.url ?? `storage://${uploaded.provider}/${uploaded.bucket}/${uploaded.key}`,
    size: uploaded.sizeBytes ?? buffer.byteLength,
    mimeType: uploaded.contentType ?? mimeType,
  }
}

async function uploadLocalDevObject(buffer: Buffer, input: UploadAssetInput, mimeType: string): Promise<UploadedAssetObject> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('local_dev storage is disabled in production.')
  }
  const storageKey = buildStorageKey(input, mimeType)
  const outputPath = path.join(process.cwd(), 'public', 'generated', storageKey)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, buffer)
  return {
    storageProvider: 'local_dev',
    bucket: 'public/generated',
    storageKey,
    url: `/generated/${storageKey}`,
    size: buffer.byteLength,
    mimeType,
  }
}

export async function uploadAsset(buffer: Buffer | ArrayBuffer | Uint8Array, input: UploadAssetInput): Promise<UploadedAssetObject> {
  const body = Buffer.isBuffer(buffer)
    ? buffer
    : buffer instanceof ArrayBuffer
      ? Buffer.from(buffer)
      : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const mimeType = input.mimeType || 'application/octet-stream'
  if (supabaseConfig().configured) return uploadSupabaseObject(body, input, mimeType)
  if (isChinaStorageConfigured()) return uploadChinaObject(body, input, mimeType)
  return uploadLocalDevObject(body, input, mimeType)
}

async function resolveSupabaseUrl(bucket: string, storageKey: string): Promise<ResolvedAssetUrl> {
  const config = supabaseConfig()
  if (!config.configured || !config.url || !config.serviceRoleKey) {
    return { url: '', source: 'missing' }
  }
  if (process.env.SUPABASE_STORAGE_PUBLIC === 'true') {
    return { url: `${config.url}/storage/v1/object/public/${bucket}/${storageKey}`, source: 'storageKey' }
  }
  const expiresIn = Number(process.env.ASSET_SIGNED_URL_TTL_SECONDS || 3600)
  const response = await fetch(`${config.url}/storage/v1/object/sign/${bucket}/${storageKey}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
  })
  if (!response.ok) return { url: '', source: 'missing' }
  const data = await response.json().catch(() => ({})) as { signedURL?: string; signedUrl?: string }
  const signedPath = data.signedURL || data.signedUrl || ''
  const url = signedPath.startsWith('http') ? signedPath : `${config.url}${signedPath}`
  return {
    url,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    source: 'storageKey',
  }
}

async function checkSupabaseObjectExists(bucket: string, storageKey: string): Promise<ObjectExistsResult> {
  const config = supabaseConfig()
  if (!config.configured || !config.url || !config.serviceRoleKey) {
    return {
      exists: false,
      status: 0,
      storageProvider: 'supabase',
      bucket,
      storageKey,
      message: 'Supabase Storage is not configured.',
    }
  }

  try {
    const response = await fetch(`${config.url}/storage/v1/object/${bucket}/${storageKey}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${config.serviceRoleKey}`,
        apikey: config.serviceRoleKey,
        Range: 'bytes=0-0',
      },
    })
    return {
      exists: response.ok || response.status === 206,
      status: response.status,
      storageProvider: 'supabase',
      bucket,
      storageKey,
      message: response.ok || response.status === 206 ? undefined : `Supabase object returned HTTP ${response.status}.`,
    }
  } catch (error) {
    return {
      exists: false,
      status: 0,
      storageProvider: 'supabase',
      bucket,
      storageKey,
      message: error instanceof Error ? error.message : 'Supabase object check failed.',
    }
  }
}

async function checkLocalDevObjectExists(bucket: string, storageKey: string): Promise<ObjectExistsResult> {
  try {
    await fs.access(path.join(process.cwd(), bucket, storageKey))
    return { exists: true, status: 200, storageProvider: 'local_dev', bucket, storageKey }
  } catch {
    return {
      exists: false,
      status: 404,
      storageProvider: 'local_dev',
      bucket,
      storageKey,
      message: 'local_dev object is missing.',
    }
  }
}

async function checkSignedObjectExists(provider: CanonicalStorageProvider, bucket: string, storageKey: string): Promise<ObjectExistsResult> {
  try {
    const object = await headChinaObject({
      provider: provider === 'aliyun-oss' || provider === 'tencent-cos' ? provider : 'aliyun-oss',
      key: storageKey,
    })
    return {
      exists: true,
      status: 200,
      storageProvider: provider,
      bucket: object.bucket || bucket,
      storageKey,
    }
  } catch (error) {
    const normalized = normalizedStorageReadError({ error, provider, bucket, storageKey, fallbackMessage: 'Object check failed.' })
    return {
      exists: false,
      status: normalized.status,
      storageProvider: provider,
      bucket,
      storageKey,
      message: normalized.message,
    }
  }
}

export async function checkObjectExists(asset: AssetUrlLike): Promise<ObjectExistsResult> {
  const storageKey = storageKeyFromMetadata(asset)
  const provider = storageProviderFromMetadata(asset)
  const bucket = bucketFromMetadata(asset)
  if (!storageKey) return { exists: false, status: 0, storageProvider: provider || null, bucket: bucket || null, storageKey: null, message: 'Asset has no storageKey.' }
  if (provider === 'supabase' && bucket) return checkSupabaseObjectExists(bucket, storageKey)
  if (provider === 'local_dev') return checkLocalDevObjectExists(bucket || 'public/generated', storageKey)
  if (provider === 'aliyun-oss' || provider === 'tencent-cos') return checkSignedObjectExists(provider, bucket || '', storageKey)
  return {
    exists: false,
    status: 0,
    storageProvider: provider || null,
    bucket: bucket || null,
    storageKey,
    message: `Storage provider ${provider || 'unknown'} is not configured for object checks.`,
  }
}

export async function resolveAssetUrl(asset: AssetUrlLike): Promise<ResolvedAssetUrl> {
  const storageKey = storageKeyFromMetadata(asset)
  const provider = storageProviderFromMetadata(asset)
  const bucket = bucketFromMetadata(asset)
  if (storageKey && provider === 'supabase' && bucket) return resolveSupabaseUrl(bucket, storageKey)
  if (storageKey && (provider === 'aliyun-oss' || provider === 'tencent-cos')) {
    const signed = await getSignedDownloadUrl({ provider, key: storageKey, contentType: undefined, expiresInSeconds: Number(process.env.ASSET_SIGNED_URL_TTL_SECONDS || 3600) })
      .catch((error: unknown) => ({
        error: error instanceof Error ? error.message : 'Could not sign object URL.',
      }))
    if ('error' in signed) {
      return {
        url: '',
        source: 'missing',
        signedUrlAvailable: false,
        errorCode: 'signing_error',
        message: signed.error,
      }
    }
    const url = signed.signedUrl || signed.url || ''
    return {
      url,
      expiresAt: signed.expiresAt,
      source: url ? 'storageKey' : 'missing',
      signedUrlAvailable: Boolean(url),
      ...(url ? {} : { errorCode: 'signing_error', message: 'Signed object URL is empty.' }),
    }
  }
  if (storageKey && provider === 'local_dev') return { url: asset.url || `/generated/${storageKey}`, source: 'storageKey' }
  if (asset.dataUrl?.startsWith('data:')) return { url: asset.dataUrl, source: 'dataUrl' }
  if (asset.url) return { url: asset.url, source: 'url' }
  return { url: '', source: 'missing' }
}

export async function readStoredAssetObject(asset: AssetUrlLike): Promise<ReadStoredAssetObjectResult> {
  const storageKey = storageKeyFromMetadata(asset)
  const provider = storageProviderFromMetadata(asset)
  const bucket = bucketFromMetadata(asset)
  if (!storageKey) {
    return {
      ok: false,
      status: 404,
      errorCode: 'object_missing',
      message: 'Asset has no storageKey.',
      storageProvider: provider || null,
      bucket: bucket || null,
      storageKey: null,
    }
  }

  if (provider === 'aliyun-oss' || provider === 'tencent-cos') {
    try {
      const object = await getChinaObject({ provider, key: storageKey })
      return {
        ok: true,
        buffer: object.body,
        mimeType: object.contentType || 'application/octet-stream',
        size: object.sizeBytes ?? object.body.byteLength,
        status: 200,
        storageProvider: object.provider,
        bucket: object.bucket || bucket,
        storageKey,
      }
    } catch (error) {
      return normalizedStorageReadError({
        error,
        provider,
        bucket,
        storageKey,
        fallbackMessage: 'Object proxy read failed.',
      })
    }
  }

  if (provider === 'supabase' && bucket) {
    const config = supabaseConfig()
    if (!config.configured || !config.url || !config.serviceRoleKey) {
      return {
        ok: false,
        status: 0,
        errorCode: 'signing_error',
        message: 'Supabase Storage is not configured.',
        storageProvider: 'supabase',
        bucket,
        storageKey,
      }
    }
    try {
      const response = await fetch(`${config.url}/storage/v1/object/${bucket}/${storageKey}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${config.serviceRoleKey}`,
          apikey: config.serviceRoleKey,
        },
      })
      if (!response.ok) {
        const errorCode = response.status === 404
          ? 'object_missing'
          : response.status === 401 || response.status === 403
            ? 'storage_permission_error'
            : 'proxy_error'
        return {
          ok: false,
          status: response.status,
          errorCode,
          message: `Supabase object returned HTTP ${response.status}.`,
          storageProvider: 'supabase',
          bucket,
          storageKey,
        }
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      return {
        ok: true,
        buffer,
        mimeType: response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream',
        size: buffer.byteLength,
        status: response.status,
        storageProvider: 'supabase',
        bucket,
        storageKey,
      }
    } catch (error) {
      return normalizedStorageReadError({
        error,
        provider: 'supabase',
        bucket,
        storageKey,
        fallbackMessage: 'Supabase object proxy read failed.',
      })
    }
  }

  if (provider === 'local_dev') {
    try {
      const filePath = path.join(process.cwd(), bucket || 'public/generated', storageKey)
      const buffer = await fs.readFile(filePath)
      return {
        ok: true,
        buffer,
        mimeType: asset.url?.endsWith('.mp4') ? 'video/mp4' : asset.url?.endsWith('.jpg') || asset.url?.endsWith('.jpeg') ? 'image/jpeg' : asset.url?.endsWith('.webp') ? 'image/webp' : 'application/octet-stream',
        size: buffer.byteLength,
        status: 200,
        storageProvider: 'local_dev',
        bucket: bucket || 'public/generated',
        storageKey,
      }
    } catch (error) {
      return normalizedStorageReadError({
        error,
        provider: 'local_dev',
        bucket: bucket || 'public/generated',
        storageKey,
        fallbackMessage: 'local_dev object proxy read failed.',
      })
    }
  }

  return {
    ok: false,
    status: 400,
    errorCode: 'proxy_error',
    message: `Storage provider ${provider || 'unknown'} is not supported by asset file proxy.`,
    storageProvider: provider || null,
    bucket: bucket || null,
    storageKey,
  }
}

async function readTextSnippet(response: Response) {
  const contentType = response.headers.get('content-type') || ''
  if (!/text|json|xml/i.test(contentType)) return ''
  return (await response.text().catch(() => '')).slice(0, 600)
}

export async function downloadExternalAsset(url: string): Promise<DownloadExternalAssetResult> {
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, status: 0, errorCode: 'URL_NOT_HTTP', message: 'Only http/https assets can be downloaded.' }
  }
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        Accept: 'image/*,video/*,audio/*,*/*;q=0.5',
        'User-Agent': 'Mozilla/5.0 (compatible; CreatorCityAssetRecovery/1.0)',
      },
    })
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        errorCode: 'ASSET_DOWNLOAD_FAILED',
        message: `External asset returned HTTP ${response.status}.`,
        bodySnippet: await readTextSnippet(response),
      }
    }
    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream'
    const buffer = Buffer.from(await response.arrayBuffer())
    return {
      ok: true,
      buffer,
      mimeType,
      size: buffer.byteLength,
      status: response.status,
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      errorCode: 'ASSET_DOWNLOAD_ERROR',
      message: error instanceof Error ? error.message : 'External asset download failed.',
    }
  }
}

export function classifyAssetUrl(url?: string | null) {
  const value = url?.trim() || ''
  const lower = value.toLowerCase()
  return {
    isEmpty: !value,
    isBlob: lower.startsWith('blob:'),
    isData: lower.startsWith('data:'),
    isTmp: lower.includes('/tmp') || lower.includes('/temporaryitems/'),
    isPublicGenerated: lower.includes('/public/generated') || lower.includes('/generated/'),
    isSigned: /x-tos-signature|x-tos-expires|x-amz-signature|x-amz-expires|x-oss-signature|x-oss-expires|signature=|expires=|security-token=/i.test(value),
    isHttp: /^https?:\/\//i.test(value),
  }
}
