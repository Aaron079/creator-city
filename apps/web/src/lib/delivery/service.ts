import { randomBytes } from 'crypto'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
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
  if (assetType === 'IMAGE') return 'image'
  if (assetType === 'VIDEO') return 'video'
  if (assetType === 'AUDIO') return 'audio'
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

export async function loadProjectDelivery(projectId: string) {
  const [share, assets] = await Promise.all([
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
  ])

  return {
    share,
    assets: assets.map(serializeDeliveryAsset),
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
