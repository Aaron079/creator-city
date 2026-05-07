import { randomBytes } from 'crypto'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { normalizeAssetType } from '@/lib/assets/normalize'
import { getProjectAccess } from '@/lib/projects/ensure-active-project'
import { serializeAsset } from '@/lib/projects/canvas-mappers'

export function createDeliveryToken() {
  return randomBytes(32).toString('base64url')
}

export async function requireProjectWriteAccess(projectId: string, userId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true, title: true, description: true, thumbnailUrl: true },
  })
  if (!project) return null
  const access = await getProjectAccess(userId, projectId)
  if (!access.canWrite) return 'FORBIDDEN' as const
  return project
}

export function assetToDeliveryType(assetType: string) {
  const type = normalizeAssetType(assetType)
  if (type === 'image') return 'image'
  if (type === 'video') return 'video'
  if (type === 'audio') return 'audio'
  if (type === 'file' || type === 'document' || type === 'model_3d' || type === 'preset' || type === 'template') return 'file'
  return 'text'
}

export function getAssetContentText(asset: { metadataJson: Prisma.JsonValue; metadata: Prisma.JsonValue }) {
  const metadata = asset.metadataJson && typeof asset.metadataJson === 'object'
    ? asset.metadataJson as Record<string, unknown>
    : asset.metadata && typeof asset.metadata === 'object'
      ? asset.metadata as Record<string, unknown>
      : {}
  const value = metadata.contentText
  return typeof value === 'string' ? value : null
}

function serializeDeliveryAsset<T extends { createdAt?: Date; updatedAt?: Date; sizeBytes?: bigint | number | null }>(asset: T) {
  return {
    ...serializeAsset(asset),
    createdAt: asset.createdAt?.toISOString(),
    updatedAt: asset.updatedAt?.toISOString(),
  }
}

function serializeDeliveryCanvasNode(node: {
  id: string
  nodeId: string
  kind: string
  title: string | null
  prompt: string | null
  resultText: string | null
  resultImageUrl: string | null
  resultVideoUrl: string | null
  resultAudioUrl: string | null
  resultPreview: string | null
  createdAt: Date
}) {
  return {
    ...node,
    createdAt: node.createdAt.toISOString(),
  }
}

export async function loadProjectDelivery(projectId: string) {
  const workflows = await db.canvasWorkflow.findMany({
    where: { projectId },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    take: 8,
  })
  const workflowIds = workflows.map((workflow) => workflow.id)

  const [share, assets, canvasNodes] = await Promise.all([
    db.deliveryShare.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
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
    }),
    db.asset.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    workflowIds.length
      ? db.canvasNode.findMany({
          where: { workflowId: { in: workflowIds } },
          orderBy: [{ createdAt: 'desc' }, { nodeId: 'asc' }],
          select: {
            id: true,
            nodeId: true,
            kind: true,
            title: true,
            prompt: true,
            resultText: true,
            resultImageUrl: true,
            resultVideoUrl: true,
            resultAudioUrl: true,
            resultPreview: true,
            createdAt: true,
          },
          take: 200,
        })
      : Promise.resolve([]),
  ])

  return {
    share,
    assets: assets.map(serializeDeliveryAsset),
    canvasNodes: canvasNodes.map(serializeDeliveryCanvasNode),
  }
}

export async function getPublicDelivery(token: string) {
  const share = await db.deliveryShare.findUnique({
    where: { token },
    include: {
      project: { select: { id: true, title: true, description: true, thumbnailUrl: true } },
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
  if (!share) return null
  if (share.status !== 'active') return 'DISABLED' as const
  if (share.expiresAt && share.expiresAt < new Date()) return 'EXPIRED' as const
  return share
}

export function serializeDeliveryShare<T extends {
  createdAt: Date
  updatedAt: Date
  expiresAt: Date | null
  items?: Array<{ createdAt: Date; asset?: unknown }>
  comments?: Array<{ createdAt: Date }>
}>(share: T) {
  return {
    ...share,
    createdAt: share.createdAt.toISOString(),
    updatedAt: share.updatedAt.toISOString(),
    expiresAt: share.expiresAt?.toISOString() ?? null,
    items: share.items?.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      asset: item.asset ? serializeDeliveryAsset(item.asset as { createdAt?: Date; updatedAt?: Date; sizeBytes?: bigint | number | null }) : item.asset,
    })),
    comments: share.comments?.map((comment) => ({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
    })),
  }
}
