import { NextRequest, NextResponse } from 'next/server'
import type { AssetType, Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { normalizeAssetType as normalizeAssetTypeValue } from '@/lib/assets/normalize'

export const dynamic = 'force-dynamic'

const ASSET_TYPES = new Set<AssetType>(['VIDEO', 'AUDIO', 'IMAGE', 'SCRIPT', 'DOCUMENT', 'MODEL_3D', 'PRESET', 'TEMPLATE'])

function normalizeAssetTypeParam(value: string | null): AssetType | undefined {
  if (!value) return undefined
  const normalized = value.trim().toUpperCase()
  if (normalized === 'TEXT') return 'SCRIPT'
  if (normalized === 'FILE') return 'DOCUMENT'
  return ASSET_TYPES.has(normalized as AssetType) ? normalized as AssetType : undefined
}

function normalizeLimit(value: string | null) {
  if (!value) return 200
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return 200
  return Math.max(1, Math.min(parsed, 200))
}

const ASSET_LIST_SELECT = {
  id: true,
  title: true,
  name: true,
  projectId: true,
  workflowId: true,
  nodeId: true,
  type: true,
  url: true,
  dataUrl: true,
  thumbnailUrl: true,
  mimeType: true,
  sizeBytes: true,
  providerId: true,
  metadataJson: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AssetSelect

type AssetListRow = Prisma.AssetGetPayload<{ select: typeof ASSET_LIST_SELECT }>

function serializeAssetForList(asset: AssetListRow) {
  return {
    ...asset,
    sizeBytes: typeof asset.sizeBytes === 'bigint' ? Number(asset.sizeBytes) : asset.sizeBytes,
    normalizedType: normalizeAssetTypeValue(asset.type),
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, errorCode: 'UNAUTHORIZED', message: '请先登录。' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')?.trim() || undefined
    const includeUnbound = searchParams.get('includeUnbound') === '1'
    const type = normalizeAssetTypeParam(searchParams.get('type'))
    const limit = normalizeLimit(searchParams.get('limit'))
    const projectFilter: Prisma.AssetWhereInput = projectId
      ? {
        OR: [
          { projectId },
          ...(includeUnbound ? [{ projectId: null }] : []),
        ],
      }
      : {}
    const where: Prisma.AssetWhereInput = {
      ownerId: user.id,
      ...(type ? { type } : {}),
      ...projectFilter,
    }

    const assets = await db.asset.findMany({
      where,
      select: ASSET_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ success: true, assets: assets.map(serializeAssetForList) })
  } catch (error) {
    console.error('[assets] failed to list assets', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, errorCode: 'ASSETS_LOAD_FAILED', message },
      { status: 500 },
    )
  }
}
