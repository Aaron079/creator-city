import { NextRequest } from 'next/server'
import { getPublicDelivery, serializeDeliveryShare } from '@/lib/delivery/service'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = {
  params: { token: string }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const share = await getPublicDelivery(params.token)
    if (!share) return jsonError('DELIVERY_NOT_FOUND', '交付链接不存在。', 404)
    if (share === 'DISABLED') return jsonError('DELIVERY_DISABLED', '交付链接已停用。', 403)
    if (share === 'EXPIRED') return jsonError('DELIVERY_EXPIRED', '交付链接已过期。', 410)

    return jsonOk({ share: serializeDeliveryShare(share) })
  } catch (error) {
    console.error('[delivery-api] failed to load public delivery', { token: params.token, error })
    return jsonError('DELIVERY_LOAD_FAILED', safeErrorMessage(error, '加载交付链接失败。'), 500)
  }
}
