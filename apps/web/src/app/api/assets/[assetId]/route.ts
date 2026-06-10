import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { getProjectAccess } from '@/lib/projects/ensure-active-project'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import { serializeAsset } from '@/lib/projects/canvas-mappers'
import { resolveAssetUrl } from '@/lib/assets/storage-adapter'
import { isDbConnectionError } from '@/lib/db-error'
import { isValidLicenseMode, deriveLicenseFields } from '@/lib/assets/license-intent'

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

    // Read-only provenance: fetch source assets referenced in metadataJson.sourceAssetIds
    const assetMeta = asset.metadataJson && typeof asset.metadataJson === 'object' && !Array.isArray(asset.metadataJson)
      ? asset.metadataJson as Record<string, unknown>
      : {}
    const sourceAssetIds = Array.isArray(assetMeta.sourceAssetIds)
      ? (assetMeta.sourceAssetIds as unknown[]).filter((x): x is string => typeof x === 'string')
      : []

    type SourceAssetEntry = {
      id: string
      unavailable?: true
      reason?: string
      title?: string | null
      type?: string
      resolvedUrl?: string | null
      thumbnailUrl?: string | null
      provider?: string | null
      source?: string | null
      mimeType?: string | null
    }

    let sourceAssets: SourceAssetEntry[] = []
    if (sourceAssetIds.length > 0) {
      const dbSources = await db.asset.findMany({
        where: { id: { in: sourceAssetIds } },
        select: {
          id: true,
          name: true,
          title: true,
          type: true,
          url: true,
          dataUrl: true,
          thumbnailUrl: true,
          storageKey: true,
          storageProvider: true,
          bucket: true,
          isPublic: true,
          ownerId: true,
          provider: true,
          source: true,
          mimeType: true,
        },
      })
      const srcMap = new Map(dbSources.map(s => [s.id, s]))
      sourceAssets = await Promise.all(
        sourceAssetIds.map(async (sid): Promise<SourceAssetEntry> => {
          const src = srcMap.get(sid)
          if (!src || (!src.isPublic && src.ownerId !== user.id)) {
            return { id: sid, unavailable: true, reason: 'private_or_missing' }
          }
          const srcResolved = await resolveAssetUrl(src)
          return {
            id: src.id,
            title: src.title ?? src.name,
            type: src.type,
            resolvedUrl: srcResolved.url || null,
            thumbnailUrl: src.thumbnailUrl ?? null,
            provider: src.provider ?? null,
            source: src.source ?? null,
            mimeType: src.mimeType,
          }
        })
      )
    }

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
        sourceAssets,
      },
    })
  } catch (error) {
    console.error('[assets] failed to get asset', { assetId: params.assetId, error })
    if (isDbConnectionError(error)) {
      return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    }
    return jsonError('ASSET_FETCH_FAILED', safeErrorMessage(error, '获取素材失败。'), 500)
  }
}

type PatchAssetBody = {
  projectId?: string | null
  title?: string
  isPublic?: boolean
  licenseIntent?: { mode: string } | null
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

    // Validate licenseIntent if provided
    if (body.licenseIntent !== undefined && body.licenseIntent !== null) {
      if (typeof body.licenseIntent !== 'object' || !isValidLicenseMode(body.licenseIntent.mode)) {
        return jsonError('VALIDATION_FAILED', '无效的授权意图模式。', 400)
      }
      if (body.licenseIntent.mode === 'marketplace_license') {
        return jsonError('MARKETPLACE_LICENSE_NOT_AVAILABLE', '市场授权将在 Marketplace 阶段开放。', 400)
      }
    }

    const asset = await db.asset.findFirst({
      where: { id: params.assetId, ownerId: user.id },
      select: { id: true, metadataJson: true },
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

    // Build metadataJson update — always merge, never overwrite other keys
    let nextMetadataJson: Record<string, unknown> | undefined
    if (body.licenseIntent !== undefined) {
      const existing: Record<string, unknown> =
        asset.metadataJson && typeof asset.metadataJson === 'object' && !Array.isArray(asset.metadataJson)
          ? (asset.metadataJson as Record<string, unknown>)
          : {}
      if (body.licenseIntent === null) {
        const { licenseIntent: _removed, ...rest } = existing
        void _removed
        nextMetadataJson = rest
      } else {
        const mode = body.licenseIntent.mode as Parameters<typeof deriveLicenseFields>[0]
        nextMetadataJson = {
          ...existing,
          licenseIntent: {
            mode,
            ...deriveLicenseFields(mode),
            updatedAt: new Date().toISOString(),
            updatedBy: user.id,
          },
        }
      }
    }

    const updateData: Parameters<typeof db.asset.update>[0]['data'] = {}
    if (nextProjectId !== undefined) updateData.projectId = nextProjectId
    if (nextTitle !== undefined) updateData.title = nextTitle || null
    if (nextIsPublic !== undefined) updateData.isPublic = nextIsPublic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (nextMetadataJson !== undefined) updateData.metadataJson = nextMetadataJson as any

    const updated = await db.asset.update({
      where: { id: params.assetId },
      data: updateData,
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
    if (isDbConnectionError(error)) {
      return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    }
    return jsonError('ASSET_UPDATE_FAILED', safeErrorMessage(error, '更新素材失败。'), 500)
  }
}
