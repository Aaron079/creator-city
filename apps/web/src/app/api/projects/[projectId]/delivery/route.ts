import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import {
  createDeliveryToken,
  loadProjectDelivery,
  requireProjectWriteAccess,
  serializeDeliveryShare,
} from '@/lib/delivery/service'
import { projectJsonError } from '@/lib/projects/api-errors'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: { projectId: string }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  const project = await requireProjectWriteAccess(params.projectId, user.id)
  if (!project) return projectJsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
  if (project === 'FORBIDDEN') return projectJsonError('FORBIDDEN', '无权访问该项目。', 403)

  const delivery = await loadProjectDelivery(params.projectId)
  return NextResponse.json({
    project,
    share: delivery.share ? serializeDeliveryShare(delivery.share) : null,
    assets: delivery.assets,
  })
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  const project = await requireProjectWriteAccess(params.projectId, user.id)
  if (!project) return projectJsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
  if (project === 'FORBIDDEN') return projectJsonError('FORBIDDEN', '无权访问该项目。', 403)

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

  return NextResponse.json({ success: true, share: serializeDeliveryShare(share) }, { status: existing ? 200 : 201 })
}
