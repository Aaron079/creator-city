import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

const REUSABLE_MODES = new Set(['reusable_noncommercial', 'reusable_commercial'])

function getLicenseMode(metadataJson: unknown): string | null {
  if (!metadataJson || typeof metadataJson !== 'object' || Array.isArray(metadataJson)) return null
  const mj = metadataJson as Record<string, unknown>
  const li = mj.licenseIntent
  if (!li || typeof li !== 'object' || Array.isArray(li)) return null
  const obj = li as Record<string, unknown>
  return typeof obj.mode === 'string' ? obj.mode : null
}

function getMarketplaceIntentRaw(metadataJson: unknown): Record<string, unknown> | null {
  if (!metadataJson || typeof metadataJson !== 'object' || Array.isArray(metadataJson)) return null
  const mj = metadataJson as Record<string, unknown>
  const mi = mj.marketplaceIntent
  if (!mi || typeof mi !== 'object' || Array.isArray(mi)) return null
  return mi as Record<string, unknown>
}

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const assets = await db.asset.findMany({
      where: {
        isPublic: true,
        status: 'READY',
      },
      select: {
        id: true,
        title: true,
        name: true,
        type: true,
        url: true,
        dataUrl: true,
        thumbnailUrl: true,
        metadataJson: true,
        provider: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            displayName: true,
            username: true,
            profile: { select: { avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Filter: licenseIntent.mode must be reusable
    const filtered = assets.filter((a) => {
      const mode = getLicenseMode(a.metadataJson)
      return mode !== null && REUSABLE_MODES.has(mode)
    })

    // Sort: wantsToList=true first
    filtered.sort((a, b) => {
      const aWants = getMarketplaceIntentRaw(a.metadataJson)?.wantsToList === true
      const bWants = getMarketplaceIntentRaw(b.metadataJson)?.wantsToList === true
      if (aWants === bWants) return 0
      return aWants ? -1 : 1
    })

    const items = filtered.map((a) => {
      const mj =
        a.metadataJson && typeof a.metadataJson === 'object' && !Array.isArray(a.metadataJson)
          ? (a.metadataJson as Record<string, unknown>)
          : {}
      const licenseIntent =
        mj.licenseIntent && typeof mj.licenseIntent === 'object' && !Array.isArray(mj.licenseIntent)
          ? mj.licenseIntent
          : null
      const marketplaceIntent =
        mj.marketplaceIntent && typeof mj.marketplaceIntent === 'object' && !Array.isArray(mj.marketplaceIntent)
          ? mj.marketplaceIntent
          : null
      return {
        id: a.id,
        title: a.title ?? a.name,
        type: a.type,
        url: a.url || a.dataUrl || null,
        thumbnailUrl: a.thumbnailUrl ?? null,
        owner: {
          id: a.owner.id,
          displayName: a.owner.displayName,
          username: a.owner.username ?? null,
          avatarUrl: a.owner.profile?.avatarUrl ?? null,
        },
        licenseIntent,
        marketplaceIntent,
        provider: a.provider ?? null,
        createdAt: a.createdAt.toISOString(),
      }
    })

    return jsonOk({ items })
  } catch (error) {
    console.error('[marketplace/listings] failed', { error })
    if (isDbConnectionError(error)) {
      return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    }
    return jsonError('LISTINGS_FETCH_FAILED', '获取市场列表失败。', 500)
  }
}
