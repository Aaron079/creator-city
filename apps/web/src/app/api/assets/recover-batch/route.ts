import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import { resolveAssetById, type AssetResolveResult } from '@/lib/assets/asset-resolver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RecoverBatchBody = {
  assetIds?: unknown
}

function uniqueAssetIds(value: unknown) {
  const ids = Array.isArray(value) ? value : []
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())).map((id) => id.trim()))].slice(0, 100)
}

function summarize(assets: AssetResolveResult[]) {
  return assets.reduce((summary, asset) => {
    summary.total += 1
    if (asset.status === 'ready') summary.ready += 1
    if (asset.actionTaken === 'reuploaded_from_original_url' || asset.actionTaken === 'recovered_from_provider') summary.recovered += 1
    if (asset.status.startsWith('unrecoverable_')) summary.unrecoverable += 1
    return summary
  }, {
    total: 0,
    ready: 0,
    recovered: 0,
    unrecoverable: 0,
  })
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    let body: RecoverBatchBody
    try {
      body = await request.json() as RecoverBatchBody
    } catch {
      return jsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
    }

    const assetIds = uniqueAssetIds(body.assetIds)
    if (!assetIds.length) return jsonOk({ summary: { total: 0, ready: 0, recovered: 0, unrecoverable: 0 }, assets: [] })

    const assets: AssetResolveResult[] = []
    for (const assetId of assetIds) {
      const recovered = await resolveAssetById(assetId, user.id)
      if (recovered) assets.push(recovered)
    }

    return jsonOk({ summary: summarize(assets), assets })
  } catch (error) {
    console.error('[assets/recover-batch] failed', error)
    return jsonError('ASSET_RECOVER_BATCH_FAILED', safeErrorMessage(error, '批量恢复素材失败。'), 500)
  }
}
