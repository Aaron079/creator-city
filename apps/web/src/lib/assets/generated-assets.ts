import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import type { GenerateResponse, GenerateResult, GenerateNodeType } from '@/lib/providers/types'
import { toAssetType } from '@/lib/projects/canvas-mappers'

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

export async function saveGeneratedAsset(input: SaveGeneratedAssetInput) {
  const payload = getAssetPayload(input.result, input.nodeType)
  if (!payload) return null

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
    providerMetadata,
  } satisfies Prisma.InputJsonObject

  return db.asset.create({
    data: {
      name: payload.title ?? `${input.nodeType} generation ${new Date().toISOString()}`,
      title: payload.title,
      type: toAssetType(input.nodeType),
      status: 'READY',
      ownerId: input.userId,
      projectId: input.projectId ?? null,
      workflowId: workflow?.id ?? null,
      nodeId: input.nodeId ?? null,
      url: payload.url,
      dataUrl: payload.dataUrl,
      thumbnailUrl: input.result.previewUrl ?? input.result.imageUrl ?? null,
      mimeType: payload.mimeType,
      metadata,
      metadataJson: metadata,
      providerId: input.providerId,
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
