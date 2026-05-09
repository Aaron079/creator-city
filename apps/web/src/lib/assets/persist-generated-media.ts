import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { toAssetType } from '@/lib/projects/canvas-mappers'
import { isChinaStorageError } from '@/lib/storage/china/errors'
import { getConfiguredChinaStorageProvider, isChinaStorageConfigured, putChinaObject } from '@/lib/storage/china/gateway'

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
      storageProvider: 'aliyun-oss' | 'asset' | 'external'
      persistedAt: string
    }
  | {
      ok: false
      errorCode: string
      message: string
      upstreamStatus?: number
    }

function safeFileName(name: string) {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned.slice(0, 120) || 'generated-media'
}

function extensionForMimeType(mimeType: string, type: PersistGeneratedMediaInput['type']) {
  if (mimeType.includes('jpeg')) return 'jpg'
  if (mimeType.includes('webp')) return 'webp'
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('quicktime')) return 'mov'
  return type === 'image' ? 'png' : 'mp4'
}

function fallbackMimeType(type: PersistGeneratedMediaInput['type']) {
  return type === 'image' ? 'image/png' : 'video/mp4'
}

function jsonMetadata(input: PersistGeneratedMediaInput, uploaded: {
  provider: string
  bucket: string
  key: string
  sizeBytes?: number
}, originalUrl: string) {
  return {
    source: 'generated-media-persistence',
    originalProviderUrl: originalUrl,
    sourceProvider: input.sourceProvider,
    nodeId: input.nodeId,
    projectId: input.projectId,
    mediaType: input.type,
    mediaPersistence: {
      status: 'persisted',
      storageProvider: uploaded.provider,
      bucket: uploaded.bucket,
      key: uploaded.key,
      sizeBytes: uploaded.sizeBytes,
      persistedAt: new Date().toISOString(),
    },
    ...(input.metadata ?? {}),
  } satisfies Prisma.InputJsonObject
}

export async function persistGeneratedMedia(input: PersistGeneratedMediaInput): Promise<PersistGeneratedMediaResult> {
  const url = input.url?.trim()
  if (!url) {
    return { ok: false, errorCode: 'MEDIA_URL_REQUIRED', message: '媒体 URL 不能为空。' }
  }
  if (!input.userId) {
    return { ok: false, errorCode: 'MEDIA_OWNER_REQUIRED', message: '缺少媒体归属用户，无法保存 Asset。' }
  }
  if (!isChinaStorageConfigured()) {
    return { ok: false, errorCode: 'STORAGE_NOT_CONFIGURED', message: '对象存储未配置，无法转存生成媒体。' }
  }

  let response: Response
  try {
    response = await fetch(url, { cache: 'no-store' })
  } catch (error) {
    return {
      ok: false,
      errorCode: 'MEDIA_FETCH_FAILED',
      message: error instanceof Error ? error.message : '拉取生成媒体失败。',
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      errorCode: 'MEDIA_FETCH_FAILED',
      message: `拉取生成媒体失败（HTTP ${response.status}）。`,
      upstreamStatus: response.status,
    }
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || fallbackMimeType(input.type)
  const body = Buffer.from(await response.arrayBuffer())
  const assetId = randomUUID()
  const now = new Date()
  const year = String(now.getUTCFullYear())
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const fileName = safeFileName(input.filenameHint || `${input.type}-${assetId}.${extensionForMimeType(contentType, input.type)}`)
  const key = `assets/${input.userId}/${year}/${month}/${assetId}-${fileName}`

  try {
    const provider = getConfiguredChinaStorageProvider()
    const uploaded = await putChinaObject({
      provider,
      key,
      body,
      contentType,
      metadata: {
        ownerId: input.userId,
        assetId,
        source: 'generated-media',
      },
    })
    const metadataJson = jsonMetadata(input, uploaded, url)
    const stableUrl = uploaded.publicUrl ?? uploaded.url ?? ''
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
    const asset = await db.asset.create({
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
        url: stableUrl,
        dataUrl: null,
        thumbnailUrl: input.type === 'image' ? stableUrl : null,
        mimeType: contentType,
        sizeBytes: BigInt(uploaded.sizeBytes ?? body.byteLength),
        metadata: metadataJson,
        metadataJson,
        providerId: uploaded.provider,
        tags: ['generated', input.type, 'persisted'],
      },
    })

    return {
      ok: true,
      assetId: asset.id,
      stableUrl,
      storageProvider: uploaded.provider === 'aliyun-oss' ? 'aliyun-oss' : 'asset',
      persistedAt: now.toISOString(),
    }
  } catch (error) {
    if (isChinaStorageError(error)) {
      return { ok: false, errorCode: error.code, message: error.message }
    }
    return {
      ok: false,
      errorCode: 'MEDIA_PERSIST_FAILED',
      message: error instanceof Error ? error.message : '生成媒体转存失败。',
    }
  }
}
