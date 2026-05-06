import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import type { GenerateResponse, GenerateResult, GenerateNodeType } from '@/lib/providers/types'
import { toAssetType } from '@/lib/projects/canvas-mappers'
import { isChinaStorageError } from '@/lib/storage/china/errors'
import { isChinaStorageConfigured, putChinaObject } from '@/lib/storage/china/gateway'

type SaveGeneratedAssetInput = {
  userId: string
  providerId: string
  nodeType: GenerateNodeType
  prompt: string
  projectId?: string
  nodeId?: string
  generationJobId?: string
  result: GenerateResult
}

function getAssetPayload(result: GenerateResult, nodeType: GenerateNodeType) {
  if (nodeType === 'text' && result.text) {
    return {
      url: '',
      dataUrl: null,
      mimeType: 'text/plain',
      title: result.text.slice(0, 80),
      contentText: result.text,
    }
  }

  const url = result.imageUrl ?? result.videoUrl ?? result.audioUrl ?? result.musicUrl ?? result.previewUrl ?? ''
  if (!url) return null

  const isDataUrl = url.startsWith('data:')
  const mimeType = isDataUrl
    ? url.slice(5, url.indexOf(';') > 5 ? url.indexOf(';') : undefined) || 'application/octet-stream'
    : nodeType === 'image'
      ? 'image/png'
      : nodeType === 'video'
        ? 'video/mp4'
        : nodeType === 'audio' || nodeType === 'music'
          ? 'audio/mpeg'
          : 'application/octet-stream'

  return {
    url,
    dataUrl: isDataUrl ? url : null,
    mimeType,
    title: null,
    contentText: null,
  }
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/)
  if (!match) return null
  const mimeType = match[1] || 'application/octet-stream'
  const isBase64 = Boolean(match[2])
  const payload = match[3] ?? ''
  const body = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload))
  return { mimeType, body }
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType === 'image/png') return 'png'
  return 'bin'
}

async function uploadGeneratedDataUrl(args: {
  assetId: string
  userId: string
  dataUrl: string
  mimeType: string
}) {
  if (!isChinaStorageConfigured()) return null
  const parsed = parseDataUrl(args.dataUrl)
  if (!parsed) return null
  const now = new Date()
  const key = [
    'assets',
    args.userId,
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    `${args.assetId}-generated.${extensionForMimeType(parsed.mimeType || args.mimeType)}`,
  ].join('/')

  try {
    return await putChinaObject({
      key,
      body: parsed.body,
      contentType: parsed.mimeType || args.mimeType,
      metadata: {
        ownerId: args.userId,
        assetId: args.assetId,
        source: 'generated-asset',
      },
    })
  } catch (error) {
    if (!isChinaStorageError(error) || error.code !== 'STORAGE_NOT_CONFIGURED') {
      console.warn('[assets] generated asset storage upload skipped', error instanceof Error ? error.message : String(error))
    }
    return null
  }
}

export async function saveGeneratedAsset(input: SaveGeneratedAssetInput) {
  const payload = getAssetPayload(input.result, input.nodeType)
  if (!payload) return null
  const assetId = randomUUID()
  const uploaded = payload.dataUrl && input.nodeType === 'image'
    ? await uploadGeneratedDataUrl({
        assetId,
        userId: input.userId,
        dataUrl: payload.dataUrl,
        mimeType: payload.mimeType,
      })
    : null

  const workflow = input.projectId
    ? await db.canvasWorkflow.findFirst({
        where: { projectId: input.projectId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      })
    : null

  const providerMetadata = input.result.metadata
    ? JSON.parse(JSON.stringify(input.result.metadata)) as Prisma.InputJsonValue
    : null
  const metadata = {
    prompt: input.prompt,
    nodeType: input.nodeType,
    contentText: payload.contentText,
    previewUrl: input.result.previewUrl ?? input.result.imageUrl ?? input.result.videoUrl ?? input.result.audioUrl ?? null,
    ...(uploaded ? {
      storageProvider: uploaded.provider,
      storageBucket: uploaded.bucket,
      storageKey: uploaded.key,
    } : {}),
    providerMetadata,
  } satisfies Prisma.InputJsonObject

  return db.asset.create({
    data: {
      id: assetId,
      name: payload.title ?? `${input.nodeType} generation ${new Date().toISOString()}`,
      title: payload.title,
      type: toAssetType(input.nodeType),
      status: 'READY',
      ownerId: input.userId,
      projectId: input.projectId ?? null,
      workflowId: workflow?.id ?? null,
      nodeId: input.nodeId ?? null,
      url: uploaded?.publicUrl ?? uploaded?.url ?? payload.url,
      dataUrl: payload.dataUrl,
      thumbnailUrl: uploaded?.publicUrl ?? uploaded?.url ?? input.result.previewUrl ?? input.result.imageUrl ?? null,
      mimeType: payload.mimeType,
      sizeBytes: uploaded?.sizeBytes ? BigInt(uploaded.sizeBytes) : undefined,
      metadata,
      metadataJson: metadata,
      providerId: uploaded?.provider ?? input.providerId,
      generationJobId: input.generationJobId ?? null,
      tags: ['generated', input.nodeType],
    },
  })
}

export async function attachGeneratedAsset(response: GenerateResponse, input: Omit<SaveGeneratedAssetInput, 'generationJobId' | 'result'>) {
  if (!response.success || !response.result) return response
  const asset = await saveGeneratedAsset({
    ...input,
    generationJobId: response.billingJobId ?? response.jobId,
    result: response.result,
  }).catch((error: unknown) => {
    console.error('[assets] failed to save generated asset', error)
    return null
  })
  if (!asset) return response
  return {
    ...response,
    result: {
      ...response.result,
      metadata: {
        ...(response.result.metadata ?? {}),
        assetId: asset.id,
      },
    },
  }
}
