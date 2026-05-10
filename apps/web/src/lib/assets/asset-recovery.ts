import type { Asset, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getSeedanceVideoStatus } from '@/lib/providers/china/volcengine'
import { classifyAssetUrl, downloadExternalAsset, resolveAssetUrl, uploadAsset } from '@/lib/assets/storage-adapter'

export type AssetAuditResult = {
  id: string
  type: string
  status: string
  url: string | null
  thumbnailUrl: string | null
  storageKey: string | null
  provider: string | null
  providerJobId: string | null
  projectId: string | null
  userId: string | null
  createdAt: string
  resolvedUrl: string | null
  reachable: boolean
  httpStatus: number
  failureReason: string | null
  isExpiredSignedUrl: boolean
  isBlobUrl: boolean
  isDataUrl: boolean
  isTmpUrl: boolean
  isPublicGeneratedUrl: boolean
  isProviderTemporaryUrl: boolean
  canRecover: boolean
  unrecoverableReason: string | null
}

type AssetForRecovery = Asset & {
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

function metadataFor(asset: AssetForRecovery) {
  return recordValue(asset.metadataJson) || recordValue(asset.metadata)
}

function providerJobIdFor(asset: AssetForRecovery) {
  const metadata = metadataFor(asset)
  return stringValue(asset.providerJobId)
    || stringValue(asset.generationJobId)
    || stringValue(metadata.providerJobId)
    || stringValue(metadata.taskId)
    || stringValue(metadata.generationJobId)
    || stringValue(recordValue(metadata.mediaPersistence).providerJobId)
}

function originalUrlFor(asset: AssetForRecovery) {
  const metadata = metadataFor(asset)
  return stringValue(asset.originalUrl)
    || stringValue(metadata.originalUrl)
    || stringValue(metadata.originalProviderUrl)
    || stringValue(metadata.originalProviderImageUrl)
    || stringValue(metadata.originalProviderVideoUrl)
    || asset.url
}

function storageKeyFor(asset: AssetForRecovery) {
  const metadata = metadataFor(asset)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return stringValue(asset.storageKey)
    || stringValue(metadata.storageKey)
    || stringValue(metadata.key)
    || stringValue(mediaPersistence.storageKey)
    || stringValue(mediaPersistence.key)
}

async function probeUrl(url: string) {
  if (!url) return { reachable: false, status: 0, reason: 'url_missing' }
  if (url.startsWith('data:')) return { reachable: true, status: 200, reason: null }
  if (url.startsWith('blob:')) return { reachable: false, status: 0, reason: 'unrecoverable_blob_url' }
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) return { reachable: false, status: 0, reason: 'url_not_http' }
  if (url.startsWith('/')) return { reachable: true, status: 200, reason: null }
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      headers: { Range: 'bytes=0-1', Accept: 'image/*,video/*,audio/*,*/*;q=0.5' },
    })
    return {
      reachable: response.ok || response.status === 206,
      status: response.status,
      reason: response.ok || response.status === 206 ? null : `http_${response.status}`,
    }
  } catch (error) {
    return {
      reachable: false,
      status: 0,
      reason: error instanceof Error ? error.message : 'fetch_failed',
    }
  }
}

export async function auditAsset(asset: AssetForRecovery): Promise<AssetAuditResult> {
  const resolved = await resolveAssetUrl(asset)
  const url = resolved.url || asset.url || asset.dataUrl || ''
  const probe = await probeUrl(url)
  const flags = classifyAssetUrl(url || asset.url || asset.dataUrl)
  const storageKey = storageKeyFor(asset)
  const providerJobId = providerJobIdFor(asset)
  const canRecover = Boolean(storageKey || providerJobId || (flags.isHttp && !flags.isBlob))
  const unrecoverableReason = flags.isBlob
    ? 'unrecoverable_blob_url'
    : !storageKey && !providerJobId && !flags.isHttp && !flags.isData
      ? 'unrecoverable_missing_source'
      : null
  return {
    id: asset.id,
    type: String(asset.type),
    status: String(asset.status),
    url: asset.url || null,
    thumbnailUrl: asset.thumbnailUrl || null,
    storageKey: storageKey || null,
    provider: asset.provider || asset.providerId || null,
    providerJobId: providerJobId || null,
    projectId: asset.projectId || null,
    userId: asset.ownerId || null,
    createdAt: asset.createdAt.toISOString(),
    resolvedUrl: resolved.url || null,
    reachable: probe.reachable,
    httpStatus: probe.status,
    failureReason: probe.reason,
    isExpiredSignedUrl: flags.isSigned && !probe.reachable,
    isBlobUrl: flags.isBlob,
    isDataUrl: flags.isData,
    isTmpUrl: flags.isTmp,
    isPublicGeneratedUrl: flags.isPublicGenerated,
    isProviderTemporaryUrl: flags.isSigned || /volc|tos|seedance|seedream|jimeng|runway|luma|pika/i.test(url),
    canRecover,
    unrecoverableReason,
  }
}

function recoveryMetadata(asset: AssetForRecovery, patch: Record<string, unknown>) {
  return {
    ...metadataFor(asset),
    recovery: {
      ...recordValue(metadataFor(asset).recovery),
      ...patch,
      checkedAt: new Date().toISOString(),
    },
  } satisfies Prisma.InputJsonObject
}

async function markAsset(asset: AssetForRecovery, status: 'READY' | 'MISSING' | 'NEEDS_RECOVERY' | 'UNRECOVERABLE', recoveryStatus: string, error?: string) {
  return db.asset.update({
    where: { id: asset.id },
    data: {
      status,
      recoveryStatus,
      error: error ?? null,
      metadataJson: recoveryMetadata(asset, { status: recoveryStatus, error }),
    },
  })
}

async function recoverFromDownload(asset: AssetForRecovery, url: string, recoveryStatus: string) {
  const downloaded = await downloadExternalAsset(url)
  if (!downloaded.ok) {
    const status = downloaded.status === 403 || downloaded.status === 404
      ? 'UNRECOVERABLE'
      : 'MISSING'
    const reason = downloaded.status === 403 || downloaded.status === 404
      ? 'unrecoverable_provider_url_expired'
      : downloaded.errorCode
    await markAsset(asset, status, reason, downloaded.message)
    return { recovered: false, status: reason, httpStatus: downloaded.status, message: downloaded.message }
  }
  const uploaded = await uploadAsset(downloaded.buffer, {
    filename: asset.filename || asset.name || `${asset.id}.${asset.type.toLowerCase()}`,
    mimeType: downloaded.mimeType,
    projectId: asset.projectId,
    userId: asset.ownerId,
    type: String(asset.type).toLowerCase(),
  })
  await db.asset.update({
    where: { id: asset.id },
    data: {
      source: asset.source === 'uploaded' ? asset.source : 'recovered',
      storageProvider: uploaded.storageProvider,
      bucket: uploaded.bucket ?? null,
      storageKey: uploaded.storageKey ?? null,
      url: uploaded.url,
      originalUrl: asset.originalUrl || url,
      mimeType: uploaded.mimeType,
      size: BigInt(uploaded.size),
      sizeBytes: BigInt(uploaded.size),
      status: 'READY',
      recoveryStatus,
      error: null,
      metadataJson: recoveryMetadata(asset, {
        status: recoveryStatus,
        originalUrl: asset.originalUrl || url,
        storageProvider: uploaded.storageProvider,
        bucket: uploaded.bucket,
        storageKey: uploaded.storageKey,
      }),
    },
  })
  return { recovered: true, status: recoveryStatus, httpStatus: downloaded.status, storageKey: uploaded.storageKey }
}

async function recoverFromProviderJob(asset: AssetForRecovery, providerJobId: string) {
  const provider = asset.provider || asset.providerId || ''
  if (provider === 'volcengine-seedance-video' || String(asset.type) === 'VIDEO') {
    const result = await getSeedanceVideoStatus(providerJobId)
    if (result.success && result.status === 'done' && result.videoUrl) {
      return recoverFromDownload(asset, result.videoUrl, 'recovered_from_provider_job')
    }
    await markAsset(asset, 'UNRECOVERABLE', 'provider_expired', result.message)
    return { recovered: false, status: 'provider_expired', message: result.message }
  }
  await markAsset(asset, 'UNRECOVERABLE', 'unrecoverable_provider_retrieve_not_implemented', `Provider retrieve not implemented for ${provider || asset.type}.`)
  return { recovered: false, status: 'unrecoverable_provider_retrieve_not_implemented' }
}

export async function recoverAsset(assetId: string) {
  const asset = await db.asset.findUnique({ where: { id: assetId } })
  if (!asset) return { recovered: false, status: 'asset_not_found' }

  const audit = await auditAsset(asset)
  let storageKeyUnreadableMessage = ''
  if (audit.storageKey) {
    const resolved = await resolveAssetUrl(asset)
    if (resolved.url) {
      await db.asset.update({
        where: { id: asset.id },
        data: {
          status: 'READY',
          recoveryStatus: 'resolved_from_storage_key',
          error: null,
          metadataJson: recoveryMetadata(asset, { status: 'resolved_from_storage_key', resolvedUrlSource: resolved.source }),
        },
      })
      return { recovered: true, status: 'resolved_from_storage_key', resolvedUrl: resolved.url }
    }
    storageKeyUnreadableMessage = 'Storage key exists but could not resolve to a readable URL.'
  }

  const flags = classifyAssetUrl(asset.url)
  if (flags.isBlob) {
    await markAsset(asset, 'UNRECOVERABLE', 'unrecoverable_blob_url', 'Browser blob URL expired and no permanent storage key was saved.')
    return { recovered: false, status: 'unrecoverable_blob_url' }
  }

  const originalUrl = originalUrlFor(asset)
  if (originalUrl && /^https?:\/\//i.test(originalUrl)) {
    const recovered = await recoverFromDownload(asset, originalUrl, 'recovered_from_old_url')
    if (recovered.recovered) return recovered
  }

  const providerJobId = providerJobIdFor(asset)
  if (providerJobId) return recoverFromProviderJob(asset, providerJobId)

  if (audit.storageKey) {
    await markAsset(asset, 'MISSING', 'storage_key_unreadable_without_recovery_source', storageKeyUnreadableMessage || 'Storage key exists but no originalUrl or providerJobId can recover it.')
    return { recovered: false, status: 'storage_key_unreadable_without_recovery_source' }
  }

  await markAsset(asset, 'UNRECOVERABLE', 'unrecoverable_missing_source', 'No storageKey, readable URL, or providerJobId was saved.')
  return { recovered: false, status: 'unrecoverable_missing_source' }
}

export async function auditAssetsForUser(userId: string, ids?: string[]) {
  const assets = await db.asset.findMany({
    where: {
      ownerId: userId,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })
  const rows = await Promise.all(assets.map(auditAsset))
  return {
    rows,
    summary: summarizeAssetAudit(rows),
  }
}

export function summarizeAssetAudit(rows: AssetAuditResult[]) {
  return {
    total: rows.length,
    ready: rows.filter((row) => row.status === 'READY').length,
    failed: rows.filter((row) => row.status === 'FAILED').length,
    reachable: rows.filter((row) => row.reachable).length,
    http403or404: rows.filter((row) => row.httpStatus === 403 || row.httpStatus === 404).length,
    expiredSignedUrl: rows.filter((row) => row.isExpiredSignedUrl).length,
    missingStorageKey: rows.filter((row) => !row.storageKey).length,
    missingProviderJobId: rows.filter((row) => !row.providerJobId).length,
    likelyRecoverable: rows.filter((row) => row.canRecover && !row.unrecoverableReason).length,
    unrecoverable: rows.filter((row) => row.unrecoverableReason).length,
  }
}
