import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'
import { membershipGateResponse } from '@/lib/membership/server'
import {
  submitMarketplaceInquiry,
  serializeInquiry,
  MarketplaceInquiryError,
} from '@/lib/marketplace/inquiry'

export const dynamic = 'force-dynamic'

const DISCLAIMER = '合作意向仅用于记录双方沟通意向，不代表授权成交，不触发平台担保、资金托管、积分结算或授权凭证。正式授权条款请双方线下确认。'

type RouteContext = { params: { id: string } }

// ─── POST /api/marketplace/listings/[id]/inquiries ────────────────────────────
// Buyer submits a contact/inquiry for a listing.
// Requires active membership (ADMIN bypass).

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const gate = membershipGateResponse(user)
    if (gate) return gate

    let body: { message?: string } = {}
    try { body = await request.json() } catch { /* no body */ }

    const inquiry = await submitMarketplaceInquiry(params.id, user.id, body.message)

    return jsonOk({ inquiry: serializeInquiry(inquiry), warning: DISCLAIMER }, { status: 201 })
  } catch (error) {
    if (error instanceof MarketplaceInquiryError) {
      const status =
        error.code === 'LISTING_NOT_FOUND' ? 404
        : error.code === 'LISTING_NOT_ACTIVE' ? 409
        : error.code === 'CANNOT_INQUIRE_OWN_LISTING' ? 422
        : error.code === 'INQUIRY_MESSAGE_TOO_LONG' ? 422
        : 400
      return jsonError(error.code, error.message, status)
    }
    console.error('[marketplace/listings/[id]/inquiries] POST failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    return jsonError('MARKETPLACE_INQUIRY_FAILED', '提交合作意向失败，请稍后重试。', 500)
  }
}
