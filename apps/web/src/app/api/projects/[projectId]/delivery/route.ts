import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import {
  createDeliveryToken,
  loadProjectDelivery,
  requireProjectWriteAccess,
  serializeDeliveryShare,
} from '@/lib/delivery/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = {
  params: { projectId: string }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const project = await requireProjectWriteAccess(params.projectId, user.id)
    if (!project) return jsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
    if (project === 'FORBIDDEN') return jsonError('FORBIDDEN', '无权访问该项目。', 403)

    const delivery = await loadProjectDelivery(params.projectId)
    const serializedShare = delivery.share ? serializeDeliveryShare(delivery.share) : null
    const serializedShares = delivery.shares.map(serializeDeliveryShare)
    return jsonOk({
      project,
      share: serializedShare,
      shares: serializedShares,
      items: serializedShare?.items ?? [],
      comments: serializedShare?.comments ?? [],
      assets: delivery.assets,
      canvasNodes: delivery.canvasNodes,
    })
  } catch (error) {
    console.error('[delivery] failed to load project delivery', { projectId: params.projectId, error })
    return jsonError('DELIVERY_LOAD_FAILED', safeErrorMessage(error, '加载项目交付失败。'), 500)
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const project = await requireProjectWriteAccess(params.projectId, user.id)
    if (!project) return jsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
    if (project === 'FORBIDDEN') return jsonError('FORBIDDEN', '无权访问该项目。', 403)

    let body: { title?: string; expiresAt?: string | null } = {}
    try {
      body = await request.json() as typeof body
    } catch {
      body = {}
    }

    const existing = await db.deliveryShare.findFirst({
      where: { projectId: params.projectId, ownerId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    const title = body.title?.trim() || `${project.title} 客户交付`
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
    const share = existing
      ? await db.deliveryShare.update({
          where: { id: existing.id },
          data: { title, status: 'active', expiresAt },
          include: { items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }, comments: { orderBy: { createdAt: 'desc' } } },
        })
      : await db.deliveryShare.create({
          data: {
            projectId: params.projectId,
            ownerId: user.id,
            token: createDeliveryToken(),
            title,
            status: 'active',
            expiresAt,
          },
          include: { items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }, comments: { orderBy: { createdAt: 'desc' } } },
        })

    return jsonOk({ share: serializeDeliveryShare(share) }, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error('[delivery] failed to create project delivery', { projectId: params.projectId, error })
    return jsonError('DELIVERY_CREATE_FAILED', safeErrorMessage(error, '创建交付链接失败。'), 500)
  }
}
