import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { normalizeAssetType } from '@/lib/assets/normalize'
import {
  assetToDeliveryType,
  createDeliveryToken,
  getAssetContentText,
  requireProjectWriteAccess,
  serializeDeliveryShare,
} from '@/lib/delivery/service'
import { projectJsonError } from '@/lib/projects/api-errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = {
  params: { projectId: string }
}

type SubmitDeliveryBody = {
  title?: string
  recipientName?: string
  recipientEmail?: string
  message?: string
  assetIds?: string[]
  canvasNodeIds?: string[]
}

type DeliveryAsset = NonNullable<Awaited<ReturnType<typeof db.asset.findFirst>>>
type DeliveryCanvasNode = NonNullable<Awaited<ReturnType<typeof db.canvasNode.findFirst>>>

function jsonError(errorCode: string, message: string, status: number) {
  return NextResponse.json({ success: false, errorCode, message }, { status })
}

function uniqueStrings(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())))
    : []
}

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
  try {
    const user = await getCurrentUser()
    if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

    const project = await requireProjectWriteAccess(params.projectId, user.id)
    if (!project) return projectJsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
    if (project === 'FORBIDDEN') return projectJsonError('FORBIDDEN', '无权访问该项目。', 403)

    let body: SubmitDeliveryBody
    try {
      body = await request.json() as SubmitDeliveryBody
    } catch {
      return projectJsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
    }

    const assetIds = uniqueStrings(body.assetIds)
    const canvasNodeIds = uniqueStrings(body.canvasNodeIds)
    if (assetIds.length + canvasNodeIds.length === 0) {
      return jsonError('DELIVERY_ITEMS_REQUIRED', '请至少选择一个要交付的作品。', 400)
    }

    const assets = assetIds.length
      ? await db.asset.findMany({
          where: {
            id: { in: assetIds },
            ownerId: user.id,
            OR: [{ projectId: params.projectId }, { projectId: null }],
          },
        })
      : []
    if (assets.length !== assetIds.length) {
      return jsonError('ASSET_NOT_FOUND', '部分素材不存在、未授权或不属于该项目。', 404)
    }

    const unboundAssetIds = assets.filter((asset) => !asset.projectId).map((asset) => asset.id)
    if (unboundAssetIds.length) {
      await db.asset.updateMany({
        where: { id: { in: unboundAssetIds }, ownerId: user.id, projectId: null },
        data: { projectId: params.projectId },
      })
    }

    const workflows = canvasNodeIds.length
      ? await db.canvasWorkflow.findMany({ where: { projectId: params.projectId }, select: { id: true } })
      : []
    const workflowIds = workflows.map((workflow) => workflow.id)
    const canvasNodes = canvasNodeIds.length && workflowIds.length
      ? await db.canvasNode.findMany({
          where: {
            workflowId: { in: workflowIds },
            OR: [{ nodeId: { in: canvasNodeIds } }, { id: { in: canvasNodeIds } }],
          },
        })
      : []
    const matchedNodeIds = new Set(canvasNodes.flatMap((node) => [node.id, node.nodeId]))
    if (canvasNodeIds.some((nodeId) => !matchedNodeIds.has(nodeId))) {
      return jsonError('CANVAS_NODE_NOT_FOUND', '部分画布节点不存在或不属于该项目。', 404)
    }

    const title = body.title?.trim() || `${project.title} 客户交付`
    const recipientName = body.recipientName?.trim() || null
    const recipientEmail = body.recipientEmail?.trim() || null
    const message = body.message?.trim() || null
    const share = await db.deliveryShare.create({
      data: {
        projectId: params.projectId,
        ownerId: user.id,
        token: createDeliveryToken(),
        title,
        status: 'active',
        recipientName,
        recipientEmail,
        message,
        metadataJson: {
          recipientName,
          recipientEmail,
          message,
          submittedAt: new Date().toISOString(),
        } satisfies Prisma.InputJsonValue,
      },
    })

    let sortOrder = 0
    const items = []
    for (const assetId of assetIds) {
      const asset = assets.find((item) => item.id === assetId)
      if (!asset) continue
      const type = assetToDeliveryType(asset.type)
      items.push(await db.deliveryItem.create({
        data: {
          shareId: share.id,
          assetId: asset.id,
          canvasNodeId: asset.nodeId ?? null,
          type,
          title: asset.title || asset.name,
          url: asset.url || asset.dataUrl || null,
          contentText: type === 'text' ? contentTextFromAsset(asset) : null,
          sortOrder: sortOrder++,
        },
      }))
    }

    for (const requestedNodeId of canvasNodeIds) {
      const node = canvasNodes.find((item) => item.nodeId === requestedNodeId || item.id === requestedNodeId)
      if (!node) continue
      const type = nodeToDeliveryType(node)
      items.push(await db.deliveryItem.create({
        data: {
          shareId: share.id,
          assetId: null,
          canvasNodeId: node.nodeId,
          type,
          title: node.title || node.prompt || '未命名画布节点',
          url: nodeDeliveryUrl(node),
          contentText: node.resultText || node.prompt || null,
          sortOrder: sortOrder++,
        },
      }))
    }

    const shareWithRelations = await db.deliveryShare.findUniqueOrThrow({
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

    return NextResponse.json({
      success: true,
      share: serializeDeliveryShare(shareWithRelations),
      items,
      publicUrl: `/delivery/${share.token}`,
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[delivery-submit] failed', { projectId: params.projectId, error })
    return jsonError('DELIVERY_SUBMIT_FAILED', `生成客户交付链接失败：${message}`, 500)
  }
}
