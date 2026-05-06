import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import {
  assetToDeliveryType,
  getAssetContentText,
  requireProjectWriteAccess,
  serializeDeliveryShare,
} from '@/lib/delivery/service'
import { projectJsonError } from '@/lib/projects/api-errors'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: { projectId: string }
}

type AddDeliveryItemBody = {
  assetId?: string
  canvasNodeId?: string
  title?: string
  type?: 'text' | 'image' | 'video' | 'audio'
  url?: string
  contentText?: string
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  const project = await requireProjectWriteAccess(params.projectId, user.id)
  if (!project) return projectJsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
  if (project === 'FORBIDDEN') return projectJsonError('FORBIDDEN', '无权访问该项目。', 403)

  let body: AddDeliveryItemBody
  try {
    body = await request.json() as AddDeliveryItemBody
  } catch {
    return projectJsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
  }

  const share = await db.deliveryShare.findFirst({
    where: { projectId: params.projectId, ownerId: user.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
  })
  if (!share) return projectJsonError('VALIDATION_FAILED', '请先创建交付链接。', 400)

  const asset = body.assetId
    ? await db.asset.findFirst({
        where: { id: body.assetId, ownerId: user.id, projectId: params.projectId },
      })
    : null
  if (body.assetId && !asset) return projectJsonError('PROJECT_NOT_FOUND', '素材不存在或不属于该项目。', 404)

  const maxSort = await db.deliveryItem.aggregate({
    where: { shareId: share.id },
    _max: { sortOrder: true },
  })

  const item = await db.deliveryItem.create({
    data: {
      shareId: share.id,
      assetId: asset?.id ?? null,
      canvasNodeId: body.canvasNodeId ?? asset?.nodeId ?? null,
      type: body.type ?? (asset ? assetToDeliveryType(asset.type) : 'text'),
      title: body.title?.trim() || asset?.title || asset?.name || null,
      url: body.url ?? asset?.url ?? null,
      contentText: body.contentText ?? (asset ? getAssetContentText(asset) : null),
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  })

  const updatedShare = await db.deliveryShare.findUniqueOrThrow({
    where: { id: share.id },
    include: {
      items: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { asset: true },
      },
      comments: { orderBy: { createdAt: 'desc' } },
    },
  })

  return NextResponse.json({ success: true, item, share: serializeDeliveryShare(updatedShare) }, { status: 201 })
}
