import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { normalizeAssetType } from '@/lib/assets/normalize'
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
  shareId?: string
  assetId?: string
  canvasNodeId?: string
  title?: string
  type?: 'text' | 'image' | 'video' | 'audio' | 'file'
  url?: string
  contentText?: string
  sortOrder?: number
}

type DeliveryAsset = NonNullable<Awaited<ReturnType<typeof db.asset.findFirst>>>
type DeliveryCanvasNode = NonNullable<Awaited<ReturnType<typeof db.canvasNode.findFirst>>>

function contentTextFromAsset(asset: DeliveryAsset) {
  const metadataText = getAssetContentText(asset)
  if (metadataText) return metadataText
  const type = normalizeAssetType(asset.type)
  if (type === 'script' || type === 'text') return asset.dataUrl || null
  return null
}

function nodeToDeliveryType(node: DeliveryCanvasNode) {
  const kind = normalizeAssetType(node.kind)
  if (kind === 'image' || kind === 'video' || kind === 'audio' || kind === 'text') return kind
  return 'file'
}

function nodeDeliveryUrl(node: DeliveryCanvasNode) {
  return node.resultImageUrl || node.resultVideoUrl || node.resultAudioUrl || null
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  const project = await requireProjectWriteAccess(params.projectId, user.id)
  if (!project) return projectJsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
  if (project === 'FORBIDDEN') return NextResponse.json({ success: false, errorCode: 'PROJECT_ACCESS_DENIED', message: '无权访问该项目。' }, { status: 403 })

  let body: AddDeliveryItemBody
  try {
    body = await request.json() as AddDeliveryItemBody
  } catch {
    return projectJsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
  }
  if (!body.assetId && !body.canvasNodeId) {
    return projectJsonError('VALIDATION_FAILED', 'assetId or canvasNodeId is required.', 400)
  }

  const share = body.shareId
    ? await db.deliveryShare.findFirst({
        where: { id: body.shareId, projectId: params.projectId, status: 'active' },
      })
    : await db.deliveryShare.findFirst({
        where: { projectId: params.projectId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      })
  if (!share) return NextResponse.json({ success: false, errorCode: 'DELIVERY_SHARE_NOT_FOUND', message: '请先创建交付链接。' }, { status: 404 })

  const asset = body.assetId
    ? await db.asset.findFirst({
        where: {
          id: body.assetId,
          ownerId: user.id,
          OR: [
            { projectId: params.projectId },
            { projectId: null },
          ],
        },
      })
    : null
  if (body.assetId && !asset) return NextResponse.json({ success: false, errorCode: 'ASSET_NOT_FOUND', message: '素材不存在或不属于该项目。' }, { status: 404 })
  if (asset && !asset.projectId) {
    await db.asset.update({
      where: { id: asset.id },
      data: { projectId: params.projectId },
    })
    asset.projectId = params.projectId
  }

  const workflows = body.canvasNodeId
    ? await db.canvasWorkflow.findMany({
        where: { projectId: params.projectId },
        select: { id: true },
      })
    : []
  const workflowIds = workflows.map((workflow) => workflow.id)
  const canvasNode = body.canvasNodeId && workflowIds.length
    ? await db.canvasNode.findFirst({
        where: {
          workflowId: { in: workflowIds },
          OR: [{ nodeId: body.canvasNodeId }, { id: body.canvasNodeId }],
        },
      })
    : null
  if (body.canvasNodeId && !canvasNode) {
    return NextResponse.json({ success: false, errorCode: 'CANVAS_NODE_NOT_FOUND', message: '画布节点不存在或不属于该项目。' }, { status: 404 })
  }

  const maxSort = await db.deliveryItem.aggregate({
    where: { shareId: share.id },
    _max: { sortOrder: true },
  })

  let item
  try {
    const type = body.type ?? (asset ? assetToDeliveryType(asset.type) : canvasNode ? nodeToDeliveryType(canvasNode) : 'text')
    const url = body.url ?? (asset?.url || asset?.dataUrl || null) ?? (canvasNode ? nodeDeliveryUrl(canvasNode) : null)
    const contentText = body.contentText
      ?? (asset && type === 'text' ? contentTextFromAsset(asset) : null)
      ?? (canvasNode ? canvasNode.resultText || canvasNode.prompt || null : null)
    item = await db.deliveryItem.create({
      data: {
        shareId: share.id,
        assetId: asset?.id ?? null,
        canvasNodeId: canvasNode?.nodeId ?? asset?.nodeId ?? null,
        type,
        title: body.title?.trim() || asset?.title || asset?.name || canvasNode?.title || canvasNode?.prompt || null,
        url,
        contentText,
        sortOrder: Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : (maxSort._max.sortOrder ?? -1) + 1,
      },
    })
  } catch (error) {
    console.error('[delivery] failed to create delivery item', error)
    return NextResponse.json({ success: false, errorCode: 'DELIVERY_ITEM_CREATE_FAILED', message: '创建交付素材失败。' }, { status: 500 })
  }

  const updatedShare = await db.deliveryShare.findUniqueOrThrow({
    where: { id: share.id },
    include: {
      items: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { asset: true },
      },
      comments: {
        orderBy: { createdAt: 'desc' },
        include: { item: { select: { id: true, title: true } } },
      },
    },
  })

  return NextResponse.json({ success: true, item, share: serializeDeliveryShare(updatedShare) }, { status: 201 })
}
