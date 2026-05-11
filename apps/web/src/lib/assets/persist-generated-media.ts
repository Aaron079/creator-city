import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { toAssetType } from '@/lib/projects/canvas-mappers'
import { downloadExternalAsset, uploadAsset, type CanonicalStorageProvider } from '@/lib/assets/storage-adapter'

export type PersistGeneratedMediaInput = {
  url?: string
  type: 'image' | 'video'
  projectId?: string
  workflowId?: string
  nodeId?: string
  filenameHint?: string
  sourceProvider?: string
  userId?: string
  metadata?: Record<string, unknown>
}

export type PersistGeneratedMediaResult =
  | {
      ok: true
      assetId?: string
      stableUrl: string
      storageProvider: CanonicalStorageProvider
      bucket?: string | null
      storageKey?: string | null
      mimeType?: string
      size?: number
      persistedAt: string
    }
  | {
      ok: false
      errorCode: string
      message: string
      upstreamStatus?: number
    }

function persistError(errorCode: string, message: string, upstreamStatus?: number): PersistGeneratedMediaResult {
  return {
    ok: false,
    errorCode,
    message,
    ...(upstreamStatus !== undefined ? { upstreamStatus } : {}),
  }
}

function safeFileName(name: string) {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned.slice(0, 120) || 'generated-media'
}

function dataUrlToDownloadedAsset(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/)
  if (!match) return null
  const mimeType = match[1] || 'application/octet-stream'
  const isBase64 = Boolean(match[2])
  const body = match[3] || ''
  const buffer = isBase64 ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body))
  if (!buffer.byteLength) return null
  return {
    ok: true as const,
    buffer,
    mimeType,
    size: buffer.byteLength,
    status: 200,
  }
}

function jsonMetadata(input: PersistGeneratedMediaInput, uploaded: {
  provider: string
  bucket?: string | null
  key?: string | null
  sizeBytes?: number
  mimeType?: string
}, originalUrl: string) {
  return {
    source: 'generated-media-persistence',
    originalProviderUrl: originalUrl,
    originalUrl,
    sourceProvider: input.sourceProvider,
    provider: input.sourceProvider,
    providerJobId: typeof input.metadata?.providerJobId === 'string'
      ? input.metadata.providerJobId
      : typeof input.metadata?.taskId === 'string'
        ? input.metadata.taskId
        : typeof input.metadata?.generationJobId === 'string'
          ? input.metadata.generationJobId
          : undefined,
    nodeId: input.nodeId,
    projectId: input.projectId,
    mediaType: input.type,
    storageProvider: uploaded.provider,
    bucket: uploaded.bucket,
    storageKey: uploaded.key,
    mediaPersistence: {
      status: 'persisted',
      storageProvider: uploaded.provider,
      bucket: uploaded.bucket,
      key: uploaded.key,
      storageKey: uploaded.key,
      sizeBytes: uploaded.sizeBytes,
      mimeType: uploaded.mimeType,
      persistedAt: new Date().toISOString(),
    },
    ...(input.metadata ?? {}),
  } satisfies Prisma.InputJsonObject
}

async function linkGenerationJob(input: PersistGeneratedMediaInput, assetId: string, stableUrl: string) {
  const generationJobId = typeof input.metadata?.generationJobId === 'string' ? input.metadata.generationJobId : ''
  if (!generationJobId) return

  const providerJobId = typeof input.metadata?.providerJobId === 'string'
    ? input.metadata.providerJobId
    : typeof input.metadata?.taskId === 'string'
      ? input.metadata.taskId
      : undefined

  await db.generationJob.update({
    where: { id: generationJobId },
    data: {
      projectId: input.projectId ?? undefined,
      providerJobId,
      provider: input.sourceProvider ?? undefined,
      kind: input.type,
      status: 'SUCCEEDED',
      outputAssetId: assetId,
      output: {
        assetId,
        url: stableUrl,
        type: input.type,
        providerJobId,
        completedAt: new Date().toISOString(),
      },
      completedAt: new Date(),
    },
  }).catch((error: unknown) => {
    console.warn('[assets] failed to link GenerationJob to Asset', {
      generationJobId,
      assetId,
      error: error instanceof Error ? error.message : String(error),
    })
  })
}

async function linkCanvasNode(input: PersistGeneratedMediaInput, assetId: string, stableUrl: string, uploaded: {
  storageProvider: CanonicalStorageProvider
  bucket?: string | null
  storageKey?: string | null
}) {
  if (!input.nodeId) return
  const where: Prisma.CanvasNodeWhereInput = input.workflowId
    ? { nodeId: input.nodeId, workflowId: input.workflowId }
    : input.projectId
      ? { nodeId: input.nodeId, workflow: { projectId: input.projectId } }
      : { nodeId: input.nodeId }
  const nodes = await db.canvasNode.findMany({
    where,
    select: { id: true, metadataJson: true },
    take: 10,
  }).catch(() => [])
  await Promise.all(nodes.map((node) => {
    const metadata = node.metadataJson && typeof node.metadataJson === 'object' && !Array.isArray(node.metadataJson)
      ? node.metadataJson as Record<string, unknown>
      : {}
    const mediaPersistence = metadata.mediaPersistence && typeof metadata.mediaPersistence === 'object' && !Array.isArray(metadata.mediaPersistence)
      ? metadata.mediaPersistence as Record<string, unknown>
      : {}
    return db.canvasNode.update({
      where: { id: node.id },
      data: {
        ...(input.type === 'image' ? { resultImageUrl: stableUrl } : {}),
        ...(input.type === 'video' ? { resultVideoUrl: stableUrl } : {}),
        metadataJson: {
          ...metadata,
          assetId,
          assetUrl: stableUrl,
          resolvedUrl: stableUrl,
          stableUrl,
          assetResolveStatus: 'ready',
          recoveryStatus: 'ready',
          storageProvider: uploaded.storageProvider,
          bucket: uploaded.bucket,
          storageKey: uploaded.storageKey,
          mediaPersistence: {
            ...mediaPersistence,
            status: 'persisted',
            assetId,
            stableUrl,
            storageProvider: uploaded.storageProvider,
            bucket: uploaded.bucket,
            storageKey: uploaded.storageKey,
            persistedAt: new Date().toISOString(),
          },
        },
      },
    })
  }))
}

export async function persistGeneratedMedia(input: PersistGeneratedMediaInput): Promise<PersistGeneratedMediaResult> {
  try {
    const url = input.url?.trim()
    if (!url) {
      return persistError('MEDIA_URL_REQUIRED', '媒体 URL 不能为空。')
    }
    if (!input.userId) {
      return persistError('MEDIA_UPLOAD_FAILED', '缺少媒体归属用户，无法保存 Asset。')
    }
    const downloaded = url.startsWith('data:')
      ? dataUrlToDownloadedAsset(url) ?? { ok: false as const, status: 0, errorCode: 'MEDIA_FETCH_FAILED', message: 'Data URL 无法解析为媒体文件。' }
      : await downloadExternalAsset(url)
    if (!downloaded.ok) {
      return persistError(downloaded.errorCode || 'MEDIA_FETCH_FAILED', downloaded.message, downloaded.status || undefined)
    }
    const contentType = downloaded.mimeType
    const body = downloaded.buffer
    const assetId = randomUUID()
    const now = new Date()
    const fileName = safeFileName(input.filenameHint || `${input.type}-${assetId}`)

    let uploaded: Awaited<ReturnType<typeof uploadAsset>>
    try {
      uploaded = await uploadAsset(body, {
        filename: fileName,
        mimeType: contentType,
        projectId: input.projectId,
        userId: input.userId,
        type: input.type,
      })
    } catch (error) {
      return persistError(
        'MEDIA_UPLOAD_FAILED',
        error instanceof Error ? error.message : '生成媒体上传到对象存储失败。',
      )
    }

    try {
      const metadataJson = jsonMetadata(input, {
        provider: uploaded.storageProvider,
        bucket: uploaded.bucket,
        key: uploaded.storageKey,
        sizeBytes: uploaded.size,
        mimeType: uploaded.mimeType,
      }, url)
      const stableUrl = uploaded.url
      if (!stableUrl) return persistError('MEDIA_UPLOAD_FAILED', '媒体已上传，但没有返回稳定 URL。')
      const workflow = input.workflowId
        ? await db.canvasWorkflow.findFirst({
            where: {
              id: input.workflowId,
              ...(input.projectId ? { projectId: input.projectId } : {}),
            },
            select: { id: true },
          })
        : input.projectId
          ? await db.canvasWorkflow.findFirst({
              where: { projectId: input.projectId },
              orderBy: { createdAt: 'asc' },
              select: { id: true },
            })
          : null
      let asset: Awaited<ReturnType<typeof db.asset.create>>
      try {
        asset = await db.asset.create({
        data: {
          id: assetId,
          name: input.filenameHint || `${input.type} generation ${now.toISOString()}`,
          title: input.filenameHint || null,
          type: toAssetType(input.type),
          status: 'READY',
          ownerId: input.userId,
          projectId: input.projectId ?? null,
          workflowId: workflow?.id ?? null,
          nodeId: input.nodeId ?? null,
          source: 'generated',
          provider: input.sourceProvider ?? null,
          providerJobId: typeof input.metadata?.providerJobId === 'string'
            ? input.metadata.providerJobId
            : typeof input.metadata?.taskId === 'string'
              ? input.metadata.taskId
              : typeof input.metadata?.generationJobId === 'string'
                ? input.metadata.generationJobId
                : null,
          storageProvider: uploaded.storageProvider,
          bucket: uploaded.bucket ?? null,
          storageKey: uploaded.storageKey ?? null,
          url: stableUrl,
          dataUrl: null,
          thumbnailUrl: input.type === 'image' ? stableUrl : null,
          originalUrl: url,
          filename: fileName,
          mimeType: contentType,
          size: BigInt(uploaded.size),
          sizeBytes: BigInt(uploaded.size),
          prompt: typeof input.metadata?.prompt === 'string' ? input.metadata.prompt : null,
          metadata: metadataJson,
          metadataJson,
          providerId: input.sourceProvider ?? uploaded.storageProvider,
          generationJobId: typeof input.metadata?.generationJobId === 'string' ? input.metadata.generationJobId : null,
          tags: ['generated', input.type, 'persisted'],
        },
        })
      } catch (error) {
        return persistError(
          'MEDIA_ASSET_CREATE_FAILED',
          error instanceof Error ? error.message : '媒体已上传，但 Asset 记录创建失败。',
        )
      }
      await linkGenerationJob(input, asset.id, stableUrl)
      await linkCanvasNode(input, asset.id, stableUrl, uploaded).catch((error: unknown) => {
        console.warn('[assets] failed to link CanvasNode to Asset', {
          nodeId: input.nodeId,
          assetId: asset.id,
          error: error instanceof Error ? error.message : String(error),
        })
      })

      return {
        ok: true,
        assetId: asset.id,
        stableUrl,
        storageProvider: uploaded.storageProvider,
        bucket: uploaded.bucket,
        storageKey: uploaded.storageKey,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        persistedAt: now.toISOString(),
      }
    } catch (error) {
      return persistError(
        'MEDIA_UPLOAD_FAILED',
        error instanceof Error ? error.message : '生成媒体转存失败。',
      )
    }
  } catch (error) {
    return persistError(
      'MEDIA_UPLOAD_FAILED',
      error instanceof Error ? error.message : '生成媒体转存失败。',
    )
  }
}
