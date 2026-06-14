import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'
import {
  respondMarketplaceInquiry,
  rejectMarketplaceInquiry,
  closeMarketplaceInquiry,
  serializeInquiry,
  MarketplaceInquiryError,
} from '@/lib/marketplace/inquiry'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

// ─── PATCH /api/me/marketplace-inquiries/[id] ─────────────────────────────────
// action: 'respond' → seller responds (PENDING|RESPONDED → RESPONDED)
// action: 'reject'  → seller rejects  (PENDING|RESPONDED → REJECTED)
// action: 'close'   → buyer OR seller closes (PENDING|RESPONDED → CLOSED)

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    let body: { action?: string; sellerNote?: string } = {}
    try { body = await request.json() } catch { /* no body */ }

    const { action, sellerNote } = body

    if (action !== 'respond' && action !== 'reject' && action !== 'close') {
      return jsonError('INVALID_INQUIRY_ACTION', 'action 必须为 respond、reject 或 close。', 400)
    }

    let updated
    if (action === 'respond') {
      updated = await respondMarketplaceInquiry(params.id, user.id, sellerNote ?? '')
    } else if (action === 'reject') {
      updated = await rejectMarketplaceInquiry(params.id, user.id, sellerNote)
    } else {
      updated = await closeMarketplaceInquiry(params.id, user.id)
    }

    return jsonOk({ inquiry: serializeInquiry(updated) })
  } catch (error) {
    if (error instanceof MarketplaceInquiryError) {
      const status =
        error.code === 'INQUIRY_NOT_FOUND' ? 404
        : error.code === 'FORBIDDEN' ? 403
        : error.code === 'INQUIRY_INVALID_STATE' ? 409
        : error.code === 'INQUIRY_SELLER_NOTE_REQUIRED' ? 422
        : error.code === 'INQUIRY_SELLER_NOTE_TOO_LONG' ? 422
        : 400
      return jsonError(error.code, error.message, status)
    }
    console.error('[me/marketplace-inquiries/[id]] PATCH failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('MARKETPLACE_INQUIRY_UPDATE_FAILED', '更新合作意向状态失败，请稍后重试。', 500)
  }
}
