import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const [assets, projectCount] = await Promise.all([
      db.asset.findMany({
        where: { ownerId: user.id },
        select: { type: true, isPublic: true, metadataJson: true, status: true },
      }),
      db.project.count({ where: { ownerId: user.id } }),
    ])

    const assetStats = {
      total: assets.length,
      image: assets.filter((a) => a.type === 'IMAGE').length,
      video: assets.filter((a) => a.type === 'VIDEO').length,
      audio: assets.filter((a) => a.type === 'AUDIO').length,
      public: assets.filter((a) => a.isPublic).length,
      private: assets.filter((a) => !a.isPublic).length,
      ready: assets.filter((a) => a.status === 'READY').length,
    }

    const licenseIntent: Record<string, number> = {
      private_only: 0,
      public_showcase: 0,
      reusable_noncommercial: 0,
      reusable_commercial: 0,
      marketplace_license: 0,
      unset: 0,
    }
    for (const asset of assets) {
      const meta =
        asset.metadataJson && typeof asset.metadataJson === 'object' && !Array.isArray(asset.metadataJson)
          ? (asset.metadataJson as Record<string, unknown>)
          : {}
      const li =
        meta.licenseIntent && typeof meta.licenseIntent === 'object' && !Array.isArray(meta.licenseIntent)
          ? (meta.licenseIntent as Record<string, unknown>)
          : null
      const mode = li && typeof li.mode === 'string' ? li.mode : null
      if (mode && Object.prototype.hasOwnProperty.call(licenseIntent, mode)) {
        licenseIntent[mode] = (licenseIntent[mode] ?? 0) + 1
      } else {
        licenseIntent['unset'] = (licenseIntent['unset'] ?? 0) + 1
      }
    }

    // marketplaceReady: public + reusable licenseIntent
    const REUSABLE_MODES = new Set(['reusable_noncommercial', 'reusable_commercial'])
    const marketplaceReady = assets.filter((a) => {
      if (!a.isPublic) return false
      const meta =
        a.metadataJson && typeof a.metadataJson === 'object' && !Array.isArray(a.metadataJson)
          ? (a.metadataJson as Record<string, unknown>)
          : {}
      const li =
        meta.licenseIntent && typeof meta.licenseIntent === 'object' && !Array.isArray(meta.licenseIntent)
          ? (meta.licenseIntent as Record<string, unknown>)
          : null
      return li && typeof li.mode === 'string' && REUSABLE_MODES.has(li.mode)
    }).length

    const marketplaceIntentCount = assets.filter((a) => {
      const meta =
        a.metadataJson && typeof a.metadataJson === 'object' && !Array.isArray(a.metadataJson)
          ? (a.metadataJson as Record<string, unknown>)
          : {}
      const mi =
        meta.marketplaceIntent && typeof meta.marketplaceIntent === 'object' && !Array.isArray(meta.marketplaceIntent)
          ? (meta.marketplaceIntent as Record<string, unknown>)
          : null
      return mi?.wantsToList === true
    }).length

    return jsonOk({
      assets: assetStats,
      licenseIntent,
      projects: { total: projectCount },
      marketplace: { marketplaceReady, marketplaceIntentCount },
    })
  } catch (error) {
    console.error('[me/stats] failed', { error })
    if (isDbConnectionError(error)) {
      return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    }
    return jsonError('STATS_FETCH_FAILED', '获取统计数据失败。', 500)
  }
}
