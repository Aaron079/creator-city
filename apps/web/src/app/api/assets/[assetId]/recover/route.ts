import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import { resolveAssetById } from '@/lib/assets/asset-resolver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = {
  params: { assetId: string }
}

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const assetId = params.assetId?.trim()
    if (!assetId) return jsonError('VALIDATION_FAILED', 'assetId is required.', 400)

    const recovered = await resolveAssetById(assetId, user.id)
    if (!recovered) return jsonError('ASSET_NOT_FOUND', '素材不存在。', 404)

    return jsonOk(recovered)
  } catch (error) {
    console.error('[assets/recover] failed', { assetId: params.assetId, error })
    return jsonError('ASSET_RECOVER_FAILED', safeErrorMessage(error, '恢复素材失败。'), 500)
  }
}
