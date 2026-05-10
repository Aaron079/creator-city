import type { Asset, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getSeedanceVideoStatus } from '@/lib/providers/china/volcengine'
import { checkObjectExists, classifyAssetUrl, downloadExternalAsset, resolveAssetUrl, uploadAsset } from '@/lib/assets/storage-adapter'

export type AssetResolveStatus =
  | 'ready'
  | 'missing'
  | 'needs_signed_url'
  | 'proxy_required'
  | 'missing_env'
  | 'storage_permission_error'
  | 'object_missing'
  | 'provider_error'
  | 'unrecoverable_blob_url'
  | 'unrecoverable_data_url_without_file'
  | 'unrecoverable_expired_signed_url_without_storage_key'
  | 'unrecoverable_provider_expired'
  | 'unrecoverable_provider_retrieve_not_implemented'
  | 'unrecoverable_no_record'

export type AssetResolveAction =
  | 'resolved_existing_storage'
  | 'reuploaded_from_original_url'
  | 'recovered_from_provider'
  | 'marked_missing'
  | 'marked_unrecoverable'

export type AssetResolveResult = {
  assetId: string
  status: AssetResolveStatus
  resolvedUrl: string | null
  thumbnailUrl: string | null
  storageKey: string | null
  storageProvider: string | null
  bucket: string | null
  providerJobId: string | null
  recoveryStatus: string | null
  error: string | null
  actionTaken: AssetResolveAction
}

type AssetForResolve = Asset & {
  metadataJson?: Prisma.JsonValue | null
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function metadataFor(asset: AssetForResolve) {
  return recordValue(asset.metadataJson) || recordValue(asset.metadata)
}

function storageKeyFor(asset: AssetForResolve) {
  const metadata = metadataFor(asset)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return stringValue(asset.storageKey)
    || stringValue(metadata.storageKey)
    || stringValue(recordValue(metadata.storage).key)
    || stringValue(mediaPersistence.storageKey)
    || stringValue(mediaPersistence.key)
}

function storageProviderFor(asset: AssetForResolve) {
  const metadata = metadataFor(asset)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return stringValue(asset.storageProvider)
    || stringValue(metadata.storageProvider)
    || stringValue(recordValue(metadata.storage).provider)
    || stringValue(mediaPersistence.storageProvider)
    || stringValue(mediaPersistence.provider)
}

function bucketFor(asset: AssetForResolve) {
  const metadata = metadataFor(asset)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return stringValue(asset.bucket)
    || stringValue(metadata.bucket)
    || stringValue(metadata.storageBucket)
    || stringValue(recordValue(metadata.storage).bucket)
    || stringValue(mediaPersistence.bucket)
}

function providerJobIdFor(asset: AssetForResolve) {
  const metadata = metadataFor(asset)
  return stringValue(asset.providerJobId)
    || stringValue(asset.generationJobId)
    || stringValue(metadata.providerJobId)
    || stringValue(metadata.taskId)
    || stringValue(metadata.generationJobId)
    || stringValue(recordValue(metadata.mediaPersistence).providerJobId)
}

function originalUrlFor(asset: AssetForResolve) {
  const metadata = metadataFor(asset)
  return stringValue(asset.originalUrl)
    || stringValue(metadata.originalUrl)
    || stringValue(metadata.originalProviderUrl)
    || stringValue(metadata.originalProviderImageUrl)
    || stringValue(metadata.originalProviderVideoUrl)
    || stringValue(asset.url)
}

function recoveryMetadata(asset: AssetForResolve, patch: Record<string, unknown>) {
  const metadata = metadataFor(asset)
  return {
    ...metadata,
    recovery: {
      ...recordValue(metadata.recovery),
      ...patch,
      checkedAt: new Date().toISOString(),
    },
  } satisfies Prisma.InputJsonObject
}

function resultFromAsset(
  asset: AssetForResolve,
  status: AssetResolveStatus,
  resolvedUrl: string | null,
  recoveryStatus: string | null | undefined,
  error: string | null | undefined,
  actionTaken: AssetResolveAction,
): AssetResolveResult {
  return {
    assetId: asset.id,
    status,
    resolvedUrl,
    thumbnailUrl: asset.thumbnailUrl || null,
    storageKey: storageKeyFor(asset) || null,
    storageProvider: storageProviderFor(asset) || null,
    bucket: bucketFor(asset) || null,
    providerJobId: providerJobIdFor(asset) || null,
    recoveryStatus: recoveryStatus ?? asset.recoveryStatus ?? null,
    error: error ?? asset.error ?? null,
    actionTaken,
  }
}

async function markAsset(asset: AssetForResolve, status: 'READY' | 'MISSING' | 'NEEDS_RECOVERY' | 'UNRECOVERABLE', recoveryStatus: string, error?: string | null) {
  const updated = await db.asset.update({
    where: { id: asset.id },
    data: {
      status,
      recoveryStatus,
      error: error ?? null,
      metadataJson: recoveryMetadata(asset, { status: recoveryStatus, error: error ?? null }),
    },
  })
  return updated as AssetForResolve
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/)
  if (!match) return null
  const mimeType = match[1] || 'application/octet-stream'
  const isBase64 = Boolean(match[2])
  const body = isBase64 ? Buffer.from(match[3] || '', 'base64') : Buffer.from(decodeURIComponent(match[3] || ''))
  return { buffer: body, mimeType }
}

async function persistRecoveredBuffer(asset: AssetForResolve, buffer: Buffer, mimeType: string, originalUrl: string, recoveryStatus: string) {
  const uploaded = await uploadAsset(buffer, {
    filename: asset.filename || asset.name || `${asset.id}.${String(asset.type).toLowerCase()}`,
    mimeType,
    projectId: asset.projectId,
    userId: asset.ownerId,
    type: String(asset.type).toLowerCase(),
  })
  const updated = await db.asset.update({
    where: { id: asset.id },
    data: {
      source: asset.source === 'uploaded' ? asset.source : 'recovered',
      storageProvider: uploaded.storageProvider,
      bucket: uploaded.bucket ?? null,
      storageKey: uploaded.storageKey ?? null,
      url: uploaded.url,
      originalUrl: asset.originalUrl || originalUrl,
      mimeType: uploaded.mimeType,
      size: BigInt(uploaded.size),
      sizeBytes: BigInt(uploaded.size),
      status: 'READY',
      recoveryStatus,
      error: null,
      metadataJson: recoveryMetadata(asset, {
        status: recoveryStatus,
        originalUrl: asset.originalUrl || originalUrl,
        storageProvider: uploaded.storageProvider,
        bucket: uploaded.bucket,
        storageKey: uploaded.storageKey,
      }),
    },
  }) as AssetForResolve
  const resolved = await resolveAssetUrl(updated)
  return resultFromAsset(
    updated,
    'ready',
    resolved.url || null,
    recoveryStatus,
    null,
    recoveryStatus === 'recovered_from_provider_job' ? 'recovered_from_provider' : 'reuploaded_from_original_url',
  )
}

async function recoverFromProviderJob(asset: AssetForResolve, providerJobId: string) {
  const provider = asset.provider || asset.providerId || ''
  if (provider === 'volcengine-seedance-video' || String(asset.type) === 'VIDEO') {
    const result = await getSeedanceVideoStatus(providerJobId)
    if (result.success && result.status === 'done' && result.videoUrl) {
      const downloaded = await downloadExternalAsset(result.videoUrl)
      if (downloaded.ok) {
        return persistRecoveredBuffer(asset, downloaded.buffer, downloaded.mimeType, result.videoUrl, 'recovered_from_provider_job')
      }
    }
    const updated = await markAsset(asset, 'UNRECOVERABLE', 'unrecoverable_provider_expired', result.message || 'Provider job result is no longer retrievable.')
    return resultFromAsset(updated, 'unrecoverable_provider_expired', null, 'unrecoverable_provider_expired', updated.error, 'marked_unrecoverable')
  }
  const updated = await markAsset(
    asset,
    'UNRECOVERABLE',
    'unrecoverable_provider_retrieve_not_implemented',
    `Provider retrieve is not implemented for ${provider || asset.type}.`,
  )
  return resultFromAsset(updated, 'unrecoverable_provider_retrieve_not_implemented', null, 'unrecoverable_provider_retrieve_not_implemented', updated.error, 'marked_unrecoverable')
}

export async function resolveAssetRecord(asset: AssetForResolve): Promise<AssetResolveResult> {
  const storageKey = storageKeyFor(asset)
  let storageMissMessage = ''
  if (storageKey) {
    const object = await checkObjectExists(asset)
    if (object.exists) {
      const resolved = await resolveAssetUrl(asset)
      if (resolved.url) {
        const updated = await markAsset(asset, 'READY', asset.recoveryStatus || 'resolved_from_storage_key', null)
        return resultFromAsset(updated, 'ready', resolved.url, updated.recoveryStatus, null, 'resolved_existing_storage')
      }
    }
    storageMissMessage = object.message || 'Storage key exists but object storage could not be read.'

    // checkObjectExists() may fail when the storage provider's signed-URL implementation
    // is not yet fully wired (e.g. Aliyun OSS without private signing keys). In that case,
    // resolveAssetUrl() can still return the stable public URL from asset.url as a fallback.
    // Try it before giving up and marking the asset as UNRECOVERABLE.
    if (!object.exists) {
      const resolved = await resolveAssetUrl(asset)
      if (resolved.url && /^https?:\/\//i.test(resolved.url)) {
        const updated = await markAsset(asset, 'READY', asset.recoveryStatus || 'resolved_from_asset_url', null)
        return resultFromAsset(updated, 'ready', resolved.url, updated.recoveryStatus, null, 'resolved_existing_storage')
      }
    }
  }

  const rawUrl = originalUrlFor(asset)
  const flags = classifyAssetUrl(rawUrl || asset.dataUrl || asset.url)
  if (flags.isBlob) {
    const updated = await markAsset(asset, 'UNRECOVERABLE', 'unrecoverable_blob_url', '该资产当时只保存为浏览器临时 blob URL，刷新后无法恢复。')
    return resultFromAsset(updated, 'unrecoverable_blob_url', null, 'unrecoverable_blob_url', updated.error, 'marked_unrecoverable')
  }

  const dataUrl = stringValue(asset.dataUrl) || (String(rawUrl).startsWith('data:') ? rawUrl : '')
  if (dataUrl.startsWith('data:')) {
    const parsed = dataUrlToBuffer(dataUrl)
    if (parsed) return persistRecoveredBuffer(asset, parsed.buffer, parsed.mimeType, 'data-url', 'recovered_from_data_url')
    const updated = await markAsset(asset, 'UNRECOVERABLE', 'unrecoverable_data_url_without_file', '该资产只保存了不可解析的 data URL，无法恢复成文件。')
    return resultFromAsset(updated, 'unrecoverable_data_url_without_file', null, 'unrecoverable_data_url_without_file', updated.error, 'marked_unrecoverable')
  }

  if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
    const downloaded = await downloadExternalAsset(rawUrl)
    if (downloaded.ok) {
      return persistRecoveredBuffer(asset, downloaded.buffer, downloaded.mimeType, rawUrl, 'recovered_from_old_url')
    }
    const providerJobId = providerJobIdFor(asset)
    if (providerJobId) return recoverFromProviderJob(asset, providerJobId)
    if (flags.isSigned) {
      const updated = await markAsset(asset, 'UNRECOVERABLE', 'unrecoverable_expired_signed_url_without_storage_key', '该资产只保存了过期临时签名链接，没有保存永久 storageKey。')
      return resultFromAsset(updated, 'unrecoverable_expired_signed_url_without_storage_key', null, 'unrecoverable_expired_signed_url_without_storage_key', updated.error, 'marked_unrecoverable')
    }
    const isGone = downloaded.status === 404
    const recoveryStatus = isGone
      ? 'unrecoverable_provider_expired'
      : downloaded.status === 403
        ? 'storage_permission_error'
        : 'provider_error'
    const updated = await markAsset(asset, isGone ? 'UNRECOVERABLE' : 'MISSING', recoveryStatus, downloaded.message)
    return resultFromAsset(updated, isGone ? 'unrecoverable_provider_expired' : recoveryStatus, null, updated.recoveryStatus, updated.error, isGone ? 'marked_unrecoverable' : 'marked_missing')
  }

  const providerJobId = providerJobIdFor(asset)
  if (providerJobId) return recoverFromProviderJob(asset, providerJobId)

  if (storageKey) {
    const recoveryStatus = /not configured|未配置/i.test(storageMissMessage)
      ? 'missing_env'
      : /403|permission|forbidden|accessdenied|denied/i.test(storageMissMessage)
        ? 'storage_permission_error'
        : /404|not found|missing/i.test(storageMissMessage)
          ? 'object_missing'
          : 'needs_signed_url'
    const updated = await markAsset(asset, 'MISSING', recoveryStatus, storageMissMessage || 'Storage key exists but no signed URL or proxy fallback could read it.')
    return resultFromAsset(updated, recoveryStatus, null, updated.recoveryStatus, updated.error, 'marked_missing')
  }

  const updated = await markAsset(asset, 'UNRECOVERABLE', 'unrecoverable_no_record', '当前资产没有 storageKey、可恢复原始 URL 或可查询的 providerJobId。')
  return resultFromAsset(updated, 'unrecoverable_no_record', null, 'unrecoverable_no_record', updated.error, 'marked_unrecoverable')
}

export async function resolveAssetById(assetId: string, ownerId: string) {
  const asset = await db.asset.findFirst({ where: { id: assetId, ownerId } })
  if (!asset) return null
  return resolveAssetRecord(asset)
}
