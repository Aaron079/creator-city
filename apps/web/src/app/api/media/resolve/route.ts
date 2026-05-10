import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import { resolveAssetById } from '@/lib/assets/asset-resolver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const assetId = new URL(request.url).searchParams.get('assetId')?.trim()
    if (!assetId) return jsonError('VALIDATION_FAILED', 'assetId is required.', 400)

    const resolved = await resolveAssetById(assetId, user.id)
    if (!resolved) return jsonError('ASSET_NOT_FOUND', '素材不存在。', 404)

    return jsonOk(resolved)
  } catch (error) {
    console.error('[media/resolve] failed', error)
    return jsonError('MEDIA_RESOLVE_FAILED', safeErrorMessage(error, '解析媒体失败。'), 500)
  }
}
