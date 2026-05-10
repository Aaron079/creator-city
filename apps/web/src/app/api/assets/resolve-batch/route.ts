import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import { resolveAssetById, type AssetResolveResult } from '@/lib/assets/asset-resolver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ResolveBatchBody = {
  assetIds?: unknown
}

function uniqueAssetIds(value: unknown) {
  const ids = Array.isArray(value) ? value : []
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())).map((id) => id.trim()))].slice(0, 100)
}

export async function POST(request: NextRequest) {
  try {
    let body: ResolveBatchBody
    try {
      body = await request.json() as ResolveBatchBody
    } catch {
      return jsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
    }

    const assetIds = uniqueAssetIds(body.assetIds)
    if (!assetIds.length) return jsonOk({ assets: [] })

    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const assets: AssetResolveResult[] = []
    for (const assetId of assetIds) {
      const resolved = await resolveAssetById(assetId, user.id)
      if (resolved) assets.push(resolved)
    }

    return jsonOk({ assets })
  } catch (error) {
    console.error('[assets/resolve-batch] failed', error)
    return jsonError('ASSET_RESOLVE_BATCH_FAILED', safeErrorMessage(error, '批量解析素材失败。'), 500)
  }
}
