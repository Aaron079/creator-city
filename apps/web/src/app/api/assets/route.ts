import { NextRequest, NextResponse } from 'next/server'
import type { AssetType, Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import {
  PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE,
  isProjectCanvasSchemaMissing,
  projectJsonError,
} from '@/lib/projects/api-errors'
import { normalizeAssetType as normalizeAssetTypeValue } from '@/lib/assets/normalize'
import { serializeAsset } from '@/lib/projects/canvas-mappers'

export const dynamic = 'force-dynamic'

const ASSET_TYPES = new Set<AssetType>(['VIDEO', 'AUDIO', 'IMAGE', 'SCRIPT', 'DOCUMENT', 'MODEL_3D', 'PRESET', 'TEMPLATE'])

function normalizeAssetTypeParam(value: string | null): AssetType | undefined {
  if (!value) return undefined
  const normalized = value.trim().toUpperCase()
  if (normalized === 'TEXT') return 'SCRIPT'
  return ASSET_TYPES.has(normalized as AssetType) ? normalized as AssetType : undefined
}

function normalizeLimit(value: string | null) {
  if (!value) return 200
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return 200
  return Math.max(1, Math.min(parsed, 200))
}

type AssetWithProjectLinks = Prisma.AssetGetPayload<{
  include: {
    project: { select: { id: true; title: true } }
    projectAssets: { select: { project: { select: { id: true; title: true } } } }
  }
}>

function serializeAssetForList(asset: AssetWithProjectLinks) {
  const linkedProject = asset.project ?? asset.projectAssets[0]?.project ?? null
  const { projectAssets, ...rest } = asset
  void projectAssets
  const serialized = serializeAsset({
    ...rest,
    project: linkedProject,
    projectId: rest.projectId ?? linkedProject?.id ?? null,
  })
  return {
    ...serialized,
    normalizedType: normalizeAssetTypeValue(rest.type),
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId') ?? undefined
  const includeUnbound = searchParams.get('includeUnbound') === '1'
  const type = normalizeAssetTypeParam(searchParams.get('type'))
  const limit = normalizeLimit(searchParams.get('limit'))

  try {
    const projectFilter: Prisma.AssetWhereInput = projectId
      ? {
        OR: [
          { projectId },
          { projectAssets: { some: { projectId } } },
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
      include: {
        project: { select: { id: true, title: true } },
        projectAssets: {
          ...(projectId ? { where: { projectId } } : { take: 1 }),
          select: { project: { select: { id: true, title: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ success: true, assets: assets.map(serializeAssetForList) })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return projectJsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    console.error('[assets] failed to list assets', error)
    return NextResponse.json({ success: false, errorCode: 'ASSET_LIST_FAILED', message: '加载资产失败。' }, { status: 500 })
  }
}
