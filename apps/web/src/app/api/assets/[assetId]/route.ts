import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { getProjectAccess } from '@/lib/projects/ensure-active-project'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import { serializeAsset } from '@/lib/projects/canvas-mappers'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: { assetId: string }
}

type PatchAssetBody = {
  projectId?: string | null
  title?: string
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
    const updated = await db.asset.update({
      where: { id: params.assetId },
      data: {
        ...(nextProjectId !== undefined ? { projectId: nextProjectId } : {}),
        ...(nextTitle !== undefined ? { title: nextTitle || null } : {}),
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
