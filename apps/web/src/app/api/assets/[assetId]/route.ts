import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { getProjectAccess } from '@/lib/projects/ensure-active-project'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import { serializeAsset } from '@/lib/projects/canvas-mappers'
import { resolveAssetUrl } from '@/lib/assets/storage-adapter'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: { assetId: string }
}

const ASSET_DETAIL_SELECT = {
  id: true,
  name: true,
  title: true,
  type: true,
  status: true,
  ownerId: true,
  projectId: true,
  workflowId: true,
  nodeId: true,
  source: true,
  provider: true,
  providerJobId: true,
  providerAssetId: true,
  storageProvider: true,
  bucket: true,
  storageKey: true,
  url: true,
  dataUrl: true,
  thumbnailUrl: true,
  originalUrl: true,
  filename: true,
  mimeType: true,
  size: true,
  sizeBytes: true,
  width: true,
  height: true,
  duration: true,
  prompt: true,
  negativePrompt: true,
  metadata: true,
  metadataJson: true,
  providerId: true,
  generationJobId: true,
  tags: true,
  isPublic: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, title: true } },
  owner: { select: { id: true, displayName: true } },
} as const

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const asset = await db.asset.findFirst({
      where: { id: params.assetId },
      select: ASSET_DETAIL_SELECT,
    })

    if (!asset) return jsonError('ASSET_NOT_FOUND', '素材不存在。', 404)

    // Private assets: only owner may view
    if (!asset.isPublic && asset.ownerId !== user.id) {
      return jsonError('ASSET_NOT_FOUND', '素材不存在。', 404)
    }

    const resolved = await resolveAssetUrl(asset)
    const isOwner = asset.ownerId === user.id

    return jsonOk({
      asset: {
        ...serializeAsset(asset),
        resolvedUrl: resolved.url || null,
        isOwner,
        owner: { id: asset.owner.id, displayName: asset.owner.displayName },
        prompt: asset.prompt,
        negativePrompt: asset.negativePrompt,
        metadataJson: asset.metadataJson,
        tags: asset.tags,
        isPublic: asset.isPublic,
        source: asset.source,
        provider: asset.provider,
        providerJobId: asset.providerJobId,
        generationJobId: asset.generationJobId,
        projectId: asset.projectId,
        workflowId: asset.workflowId,
        nodeId: asset.nodeId,
        project: asset.project,
        storageProvider: asset.storageProvider,
      },
    })
  } catch (error) {
    console.error('[assets] failed to get asset', { assetId: params.assetId, error })
    return jsonError('ASSET_FETCH_FAILED', safeErrorMessage(error, '获取素材失败。'), 500)
  }
}

type PatchAssetBody = {
  projectId?: string | null
  title?: string
  isPublic?: boolean
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    let body: PatchAssetBody
    try {
      body = await request.json() as PatchAssetBody
    } catch {
      return jsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
    }

    const asset = await db.asset.findFirst({
      where: { id: params.assetId, ownerId: user.id },
      select: { id: true },
    })
    if (!asset) return jsonError('ASSET_NOT_FOUND', '素材不存在。', 404)

    const nextProjectId = body.projectId === undefined ? undefined : body.projectId?.trim() || null
    if (nextProjectId) {
      const access = await getProjectAccess(user.id, nextProjectId)
      if (!access.canWrite || access.source !== 'owner') {
        return jsonError('PROJECT_ACCESS_DENIED', '无权绑定到该项目。', 403)
      }
    }

    const nextTitle = body.title === undefined ? undefined : body.title.trim()
    const nextIsPublic = typeof body.isPublic === 'boolean' ? body.isPublic : undefined

    const updated = await db.asset.update({
      where: { id: params.assetId },
      data: {
        ...(nextProjectId !== undefined ? { projectId: nextProjectId } : {}),
        ...(nextTitle !== undefined ? { title: nextTitle || null } : {}),
        ...(nextIsPublic !== undefined ? { isPublic: nextIsPublic } : {}),
      },
      include: { project: { select: { id: true, title: true } } },
    })
    if (nextProjectId) {
      await db.projectAsset.upsert({
        where: { projectId_assetId: { projectId: nextProjectId, assetId: params.assetId } },
        create: { projectId: nextProjectId, assetId: params.assetId, addedBy: user.id },
        update: { addedBy: user.id },
      })
    }

    return jsonOk({ asset: serializeAsset(updated) })
  } catch (error) {
    console.error('[assets] failed to update asset', { assetId: params.assetId, error })
    return jsonError('ASSET_UPDATE_FAILED', safeErrorMessage(error, '更新素材失败。'), 500)
  }
}
