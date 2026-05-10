import { NextRequest } from 'next/server'
import type { AssetType, Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { normalizeAssetType as normalizeAssetTypeValue } from '@/lib/assets/normalize'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import { classifyAssetUrl, resolveAssetUrl } from '@/lib/assets/storage-adapter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
  source: true,
  provider: true,
  providerJobId: true,
  providerAssetId: true,
  storageProvider: true,
  bucket: true,
  storageKey: true,
  type: true,
  status: true,
  url: true,
  dataUrl: true,
  thumbnailUrl: true,
  originalUrl: true,
  filename: true,
  mimeType: true,
  size: true,
  sizeBytes: true,
  width: true,
  height: true,
  duration: true,
  prompt: true,
  negativePrompt: true,
  providerId: true,
  metadataJson: true,
  generationJobId: true,
  recoveryStatus: true,
  error: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, title: true } },
} satisfies Prisma.AssetSelect

type AssetListRow = Prisma.AssetGetPayload<{ select: typeof ASSET_LIST_SELECT }>

async function serializeAssetForList(asset: AssetListRow) {
  const resolved = await resolveAssetUrl(asset)
  const urlFlags = classifyAssetUrl(asset.url || asset.dataUrl)
  return {
    ...asset,
    resolvedUrl: resolved.url || null,
    resolvedUrlSource: resolved.source,
    resolvedUrlExpiresAt: resolved.expiresAt,
    urlFlags,
    recoverySource: asset.storageKey ? 'storageKey' : asset.providerJobId ? 'providerJobId' : asset.url ? 'oldUrl' : 'none',
    size: typeof asset.size === 'bigint' ? Number(asset.size) : asset.size,
    sizeBytes: typeof asset.sizeBytes === 'bigint' ? Number(asset.sizeBytes) : asset.sizeBytes,
    normalizedType: normalizeAssetTypeValue(asset.type),
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return jsonError('UNAUTHORIZED', '请先登录。', 401)
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')?.trim() || undefined
    const includeUnbound = searchParams.get('includeUnbound') === '1'
    const type = normalizeAssetTypeParam(searchParams.get('type'))
    const limit = normalizeLimit(searchParams.get('limit'))
    const ids = (searchParams.get('ids') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
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
      ...(ids.length ? { id: { in: ids } } : {}),
      ...(type ? { type } : {}),
      ...projectFilter,
    }

    const assets = await db.asset.findMany({
      where,
      select: ASSET_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return jsonOk({ assets: await Promise.all(assets.map(serializeAssetForList)) })
  } catch (error) {
    console.error('[assets] failed to list assets', error)
    return jsonError('ASSETS_LOAD_FAILED', safeErrorMessage(error, '加载素材失败。'), 500)
  }
}
