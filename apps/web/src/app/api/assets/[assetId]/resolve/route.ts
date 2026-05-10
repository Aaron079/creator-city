import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import { resolveAssetById } from '@/lib/assets/asset-resolver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = {
  params: { assetId: string }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const assetId = params.assetId?.trim()
    if (!assetId) return jsonError('VALIDATION_FAILED', 'assetId is required.', 400)

    const resolved = await resolveAssetById(assetId, user.id)
    if (!resolved) return jsonError('ASSET_NOT_FOUND', '素材不存在。', 404)

    return jsonOk(resolved)
  } catch (error) {
    console.error('[assets/resolve] failed', { assetId: params.assetId, error })
    return jsonError('ASSET_RESOLVE_FAILED', safeErrorMessage(error, '解析素材失败。'), 500)
  }
}
