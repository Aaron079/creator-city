import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { getConfiguredChinaStorageProvider, getSignedDownloadUrl, isChinaStorageConfigured, putChinaObject } from '@/lib/storage/china/gateway'

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
  const signed = await getSignedDownloadUrl({
    provider: provider === 'aliyun-oss' || provider === 'tencent-cos' ? provider : 'aliyun-oss',
    key: storageKey,
    expiresInSeconds: 120,
  }).catch((error: unknown) => ({
    error: error instanceof Error ? error.message : 'Could not sign object URL.',
  }))
  if ('error' in signed) {
    return { exists: false, status: 0, storageProvider: provider, bucket, storageKey, message: signed.error }
  }
  const url = signed.signedUrl || signed.publicUrl || signed.url
  if (!url) return { exists: false, status: 0, storageProvider: provider, bucket, storageKey, message: 'Signed object URL is empty.' }
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Range: 'bytes=0-0' },
    })
    return {
      exists: response.ok || response.status === 206,
      status: response.status,
      storageProvider: provider,
      bucket,
      storageKey,
      message: response.ok || response.status === 206 ? undefined : `Object returned HTTP ${response.status}.`,
    }
  } catch (error) {
    return {
      exists: false,
      status: 0,
      storageProvider: provider,
      bucket,
      storageKey,
      message: error instanceof Error ? error.message : 'Object check failed.',
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
      .catch(() => null)
    const url = signed?.signedUrl || signed?.publicUrl || signed?.url || asset.url || ''
    return {
      url,
      expiresAt: signed?.expiresAt,
      source: url ? 'storageKey' : 'missing',
    }
  }
  if (storageKey && provider === 'local_dev') return { url: asset.url || `/generated/${storageKey}`, source: 'storageKey' }
  if (asset.dataUrl?.startsWith('data:')) return { url: asset.dataUrl, source: 'dataUrl' }
  if (asset.url) return { url: asset.url, source: 'url' }
  return { url: '', source: 'missing' }
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
