import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { downloadExternalAsset, resolveAssetUrl, uploadAsset, type CanonicalStorageProvider } from '@/lib/assets/storage-adapter'
import { classifyOssUploadError, storageDetails } from '@/lib/assets/persist-generated-media'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = {
  params: { assetId: string }
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function mediaTypeForAsset(type: string) {
  return type === 'VIDEO' ? 'video' : 'image'
}

function providerOriginalUrlFor(asset: { originalUrl?: string | null; url?: string | null; metadataJson?: unknown; metadata?: unknown }) {
  const metadata = recordValue(asset.metadataJson)
  const legacyMetadata = recordValue(asset.metadata)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return stringValue(metadata.providerOriginalUrl)
    || stringValue(metadata.temporaryUrl)
    || stringValue(metadata.originalProviderUrl)
    || stringValue(metadata.originalProviderImageUrl)
    || stringValue(metadata.originalProviderVideoUrl)
    || stringValue(mediaPersistence.providerOriginalUrl)
    || stringValue(mediaPersistence.temporaryUrl)
    || stringValue(mediaPersistence.originalUrl)
    || stringValue(legacyMetadata.providerOriginalUrl)
    || stringValue(asset.originalUrl)
    || stringValue(asset.url)
}

function providerJobIdFor(metadata: Record<string, unknown>, fallback?: string | null) {
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return stringValue(metadata.providerJobId)
    || stringValue(mediaPersistence.providerJobId)
    || stringValue(fallback)
    || null
}

async function writeReadyCanvasNodes(args: {
  assetId: string
  nodeId?: string | null
  projectId?: string | null
  workflowId?: string | null
  mediaType: 'image' | 'video'
  resolvedUrl: string
  storageProvider: CanonicalStorageProvider
  bucket?: string | null
  storageKey?: string | null
  proxyUrl?: string | null
  signedUrlAvailable?: boolean
  proxyAvailable?: boolean
}) {
  if (!args.nodeId) return 0
  const where: Prisma.CanvasNodeWhereInput = args.workflowId
    ? { nodeId: args.nodeId, workflowId: args.workflowId }
    : args.projectId
      ? { nodeId: args.nodeId, workflow: { projectId: args.projectId } }
      : { nodeId: args.nodeId }
  const nodes = await db.canvasNode.findMany({
    where,
    select: { id: true, metadataJson: true },
    take: 10,
  })
  await Promise.all(nodes.map((node) => {
    const metadata = recordValue(node.metadataJson)
    const mediaPersistence = recordValue(metadata.mediaPersistence)
    return db.canvasNode.update({
      where: { id: node.id },
      data: {
        status: 'done',
        errorMessage: null,
        ...(args.mediaType === 'image' ? { resultImageUrl: args.resolvedUrl } : {}),
        ...(args.mediaType === 'video' ? { resultVideoUrl: args.resolvedUrl } : {}),
        metadataJson: {
          ...metadata,
          assetId: args.assetId,
          outputAssetId: args.assetId,
          generationStatus: 'generation_success',
          persistenceStatus: 'persistence_success',
          assetStatus: 'ready',
          assetUrl: args.resolvedUrl,
          resolvedUrl: args.resolvedUrl,
          stableUrl: args.resolvedUrl,
          ...(args.proxyUrl ? { proxyUrl: args.proxyUrl } : {}),
          signedUrlAvailable: args.signedUrlAvailable ?? null,
          proxyAvailable: args.proxyAvailable ?? Boolean(args.proxyUrl),
          storageProvider: args.storageProvider,
          bucket: args.bucket ?? null,
          storageKey: args.storageKey ?? null,
          recoveryStatus: 'ready',
          assetResolveStatus: 'ready',
          mediaRecoveryStatus: 'recovered',
          persistenceError: null,
          errorCode: null,
          errorMessage: null,
          lastGenerationError: null,
          retryPersistenceAvailable: false,
          nextAction: 'show_media',
          mediaPersistence: {
            ...mediaPersistence,
            status: 'persisted',
            generationStatus: 'generation_success',
            persistenceStatus: 'persistence_success',
            assetId: args.assetId,
            outputAssetId: args.assetId,
            assetUrl: args.resolvedUrl,
            resolvedUrl: args.resolvedUrl,
            stableUrl: args.resolvedUrl,
            ...(args.proxyUrl ? { proxyUrl: args.proxyUrl } : {}),
            storageProvider: args.storageProvider,
            bucket: args.bucket ?? null,
            storageKey: args.storageKey ?? null,
            persistedAt: new Date().toISOString(),
            retryPersistenceAvailable: false,
          },
        },
      },
    })
  }))
  return nodes.length
}

async function writeReadyGenerationJobs(args: {
  assetId: string
  generationJobId?: string | null
  nodeId?: string | null
  provider?: string | null
  providerJobId?: string | null
  mediaType: 'image' | 'video'
  resolvedUrl: string
  storageKey?: string | null
}) {
  await db.generationJob.updateMany({
    where: {
      OR: [
        ...(args.generationJobId ? [{ id: args.generationJobId }] : []),
        { outputAssetId: args.assetId },
      ],
    },
    data: {
      nodeId: args.nodeId ?? undefined,
      provider: args.provider ?? undefined,
      providerJobId: args.providerJobId ?? undefined,
      kind: args.mediaType,
      status: 'SUCCEEDED',
      outputAssetId: args.assetId,
      output: {
        status: 'succeeded',
        generationStatus: 'generation_success',
        persistenceStatus: 'persistence_success',
        assetStatus: 'ready',
        assetId: args.assetId,
        outputAssetId: args.assetId,
        url: args.resolvedUrl,
        type: args.mediaType,
        mediaType: args.mediaType,
        storageKey: args.storageKey,
        completedAt: new Date().toISOString(),
      },
      error: null,
      errorMessage: null,
      completedAt: new Date(),
    },
  }).catch((error: unknown) => {
    console.warn('[assets/retry-persistence] failed to update GenerationJob', error)
  })
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const assetId = params.assetId?.trim()
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, errorCode: 'UNAUTHORIZED', message: '请先登录。' }, { status: 401 })
    }
    if (!assetId) {
      return NextResponse.json({ success: false, errorCode: 'asset_id_required', message: 'assetId is required.' }, { status: 400 })
    }

    const asset = await db.asset.findFirst({
      where: { id: assetId, ownerId: user.id },
    })
    if (!asset) {
      return NextResponse.json({ success: false, errorCode: 'asset_not_found', message: '素材不存在。' }, { status: 404 })
    }

    const metadata = recordValue(asset.metadataJson)
    const providerOriginalUrl = providerOriginalUrlFor(asset)
    if (!providerOriginalUrl) {
      return NextResponse.json({
        success: false,
        errorCode: 'provider_original_url_missing',
        message: 'Asset 没有 providerOriginalUrl，无法重试上传。',
        assetId,
        retryPersistenceAvailable: false,
      }, { status: 200 })
    }

    const mediaType = mediaTypeForAsset(asset.type)
    const downloaded = providerOriginalUrl.startsWith('data:')
      ? null
      : await downloadExternalAsset(providerOriginalUrl)
    const dataUrlMatch = providerOriginalUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/)
    const body = downloaded?.ok
      ? downloaded.buffer
      : dataUrlMatch
        ? dataUrlMatch[2]
          ? Buffer.from(dataUrlMatch[3] || '', 'base64')
          : Buffer.from(decodeURIComponent(dataUrlMatch[3] || ''))
        : null
    const mimeType = downloaded?.ok
      ? downloaded.mimeType
      : dataUrlMatch?.[1] || asset.mimeType || 'application/octet-stream'

    if (!body?.byteLength) {
      const message = downloaded && !downloaded.ok ? downloaded.message : 'Provider 原始媒体 URL 不可下载。'
      return NextResponse.json({
        success: false,
        errorCode: 'provider_media_download_failed',
        message,
        assetId,
        providerOriginalUrl,
        retryPersistenceAvailable: true,
      }, { status: 200 })
    }

    let uploaded: Awaited<ReturnType<typeof uploadAsset>>
    try {
      uploaded = await uploadAsset(body, {
        filename: asset.filename || asset.name,
        mimeType,
        projectId: asset.projectId,
        userId: user.id,
        type: mediaType,
      })
    } catch (error) {
      const details = storageDetails(error)
      const classified = classifyOssUploadError(error)
      const nextMetadata = {
        ...metadata,
        generationStatus: 'generation_success',
        persistenceStatus: 'pending_persistence',
        assetStatus: 'pending_persistence',
        providerOriginalUrl,
        temporaryUrl: providerOriginalUrl,
        persistenceError: classified.errorCode,
        errorCode: null,
        errorMessage: null,
        retryPersistenceAvailable: true,
        attemptedUploadKey: details.key || null,
        ossRequestId: details.requestId || null,
        mediaPersistence: {
          ...recordValue(metadata.mediaPersistence),
          status: 'pending_persistence',
          generationStatus: 'generation_success',
          persistenceStatus: 'pending_persistence',
          providerOriginalUrl,
          temporaryUrl: providerOriginalUrl,
          errorCode: classified.errorCode,
          errorMessage: classified.errorMessage,
          attemptedUploadKey: details.key || null,
          ossRequestId: details.requestId || null,
          retryPersistenceAvailable: true,
          updatedAt: new Date().toISOString(),
        },
      }
      await db.asset.update({
        where: { id: asset.id },
        data: {
          status: 'PENDING',
          recoveryStatus: 'pending_persistence',
          error: classified.errorMessage,
          metadata: nextMetadata,
          metadataJson: nextMetadata,
        },
      }).catch(() => undefined)
      return NextResponse.json({
        success: false,
        errorCode: classified.errorCode,
        errorMessage: classified.errorMessage,
        message: classified.errorMessage,
        assetId,
        providerOriginalUrl,
        temporaryUrl: providerOriginalUrl,
        persistenceStatus: 'pending_persistence',
        assetStatus: 'pending_persistence',
        storageProvider: details.provider || null,
        bucket: details.bucket || null,
        storageKey: null,
        attemptedUploadKey: details.key || null,
        ossRequestId: details.requestId || null,
        retryPersistenceAvailable: true,
      }, { status: 200 })
    }

    const proxyUrl = uploaded.storageKey ? `/api/assets/${encodeURIComponent(asset.id)}/file` : null
    const nextMetadata = {
      ...metadata,
      generationStatus: 'generation_success',
      persistenceStatus: 'persistence_success',
      assetStatus: 'ready',
      providerOriginalUrl,
      temporaryUrl: providerOriginalUrl,
      storageProvider: uploaded.storageProvider,
      bucket: uploaded.bucket ?? null,
      storageKey: uploaded.storageKey ?? null,
    }
    const resolved = await resolveAssetUrl({
      id: asset.id,
      url: uploaded.url,
      storageProvider: uploaded.storageProvider,
      bucket: uploaded.bucket,
      storageKey: uploaded.storageKey,
      metadataJson: nextMetadata,
    }).catch(() => ({ url: '', source: 'missing' as const, signedUrlAvailable: false }))
    const resolvedUrl = resolved.url || proxyUrl || uploaded.url
    const readyMetadata = {
      ...nextMetadata,
      assetId: asset.id,
      outputAssetId: asset.id,
      assetUrl: resolvedUrl,
      resolvedUrl,
      stableUrl: resolvedUrl,
      ...(proxyUrl ? { proxyUrl } : {}),
      signedUrlAvailable: Boolean(resolved.signedUrlAvailable ?? resolved.url),
      proxyAvailable: Boolean(proxyUrl),
      persistenceError: null,
      errorCode: null,
      errorMessage: null,
      retryPersistenceAvailable: false,
      nextAction: 'show_media',
      mediaPersistence: {
        ...recordValue(metadata.mediaPersistence),
        status: 'persisted',
        generationStatus: 'generation_success',
        persistenceStatus: 'persistence_success',
        assetId: asset.id,
        outputAssetId: asset.id,
        providerOriginalUrl,
        temporaryUrl: providerOriginalUrl,
        assetUrl: resolvedUrl,
        resolvedUrl,
        stableUrl: resolvedUrl,
        ...(proxyUrl ? { proxyUrl } : {}),
        storageProvider: uploaded.storageProvider,
        bucket: uploaded.bucket ?? null,
        storageKey: uploaded.storageKey ?? null,
        sizeBytes: uploaded.size,
        mimeType: uploaded.mimeType,
        persistedAt: new Date().toISOString(),
        retryPersistenceAvailable: false,
      },
    }

    await db.asset.update({
      where: { id: asset.id },
      data: {
        status: 'READY',
        recoveryStatus: 'ready',
        error: null,
        storageProvider: uploaded.storageProvider,
        bucket: uploaded.bucket ?? null,
        storageKey: uploaded.storageKey ?? null,
        url: resolvedUrl,
        thumbnailUrl: mediaType === 'image' ? resolvedUrl : asset.thumbnailUrl,
        mimeType: uploaded.mimeType,
        size: BigInt(uploaded.size),
        sizeBytes: BigInt(uploaded.size),
        metadata: readyMetadata,
        metadataJson: readyMetadata,
      },
    })
    const providerJobId = providerJobIdFor(metadata, asset.providerJobId)
    await writeReadyGenerationJobs({
      assetId: asset.id,
      generationJobId: asset.generationJobId,
      nodeId: asset.nodeId,
      provider: asset.provider,
      providerJobId,
      mediaType,
      resolvedUrl,
      storageKey: uploaded.storageKey,
    })
    const canvasNodesUpdated = await writeReadyCanvasNodes({
      assetId: asset.id,
      nodeId: asset.nodeId,
      projectId: asset.projectId,
      workflowId: asset.workflowId,
      mediaType,
      resolvedUrl,
      storageProvider: uploaded.storageProvider,
      bucket: uploaded.bucket,
      storageKey: uploaded.storageKey,
      proxyUrl,
      signedUrlAvailable: Boolean(resolved.signedUrlAvailable ?? resolved.url),
      proxyAvailable: Boolean(proxyUrl),
    })

    return NextResponse.json({
      success: true,
      ok: true,
      assetId: asset.id,
      status: 'ready',
      generationStatus: 'generation_success',
      persistenceStatus: 'persistence_success',
      assetStatus: 'ready',
      resolvedUrl,
      stableUrl: resolvedUrl,
      assetUrl: resolvedUrl,
      proxyUrl,
      storageProvider: uploaded.storageProvider,
      bucket: uploaded.bucket ?? null,
      storageKey: uploaded.storageKey ?? null,
      providerOriginalUrl,
      temporaryUrl: providerOriginalUrl,
      retryPersistenceAvailable: false,
      mediaPersistence: readyMetadata.mediaPersistence,
      canvasNodesUpdated,
      message: '资产库上传已完成。',
    }, { status: 200 })
  } catch (error) {
    console.error('[assets/retry-persistence] failed', { assetId, error })
    return NextResponse.json({
      success: false,
      errorCode: 'asset_persistence_error',
      message: error instanceof Error ? error.message : '重试上传到资产库失败。',
      assetId,
    }, { status: 500 })
  }
}
