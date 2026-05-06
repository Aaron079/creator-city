import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { getProjectAccess } from '@/lib/projects/ensure-active-project'
import { projectJsonError } from '@/lib/projects/api-errors'
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
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  let body: PatchAssetBody
  try {
    body = await request.json() as PatchAssetBody
  } catch {
    return projectJsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
  }

  const asset = await db.asset.findFirst({
    where: { id: params.assetId, ownerId: user.id },
    select: { id: true },
  })
  if (!asset) {
    return NextResponse.json({ success: false, errorCode: 'ASSET_NOT_FOUND', message: '素材不存在。' }, { status: 404 })
  }

  const nextProjectId = body.projectId === undefined ? undefined : body.projectId?.trim() || null
  if (nextProjectId) {
    const access = await getProjectAccess(user.id, nextProjectId)
    if (!access.canWrite || access.source !== 'owner') {
      return NextResponse.json({ success: false, errorCode: 'PROJECT_ACCESS_DENIED', message: '无权绑定到该项目。' }, { status: 403 })
    }
  }

  const nextTitle = body.title === undefined ? undefined : body.title.trim()
  try {
    const updated = await db.asset.update({
      where: { id: params.assetId },
      data: {
        ...(nextProjectId !== undefined ? { projectId: nextProjectId } : {}),
        ...(nextTitle !== undefined ? { title: nextTitle || null } : {}),
      },
      include: { project: { select: { id: true, title: true } } },
    })

    return NextResponse.json({ success: true, asset: serializeAsset(updated) })
  } catch (error) {
    console.error('[assets] failed to update asset', error)
    return NextResponse.json({ success: false, errorCode: 'ASSET_UPDATE_FAILED', message: '更新素材失败。' }, { status: 500 })
  }
}
