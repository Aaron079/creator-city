import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk } from '@/lib/api/json-response'
import { isDbConnectionError } from '@/lib/db-error'
import { getMyInquiryForListing, serializeInquiry } from '@/lib/marketplace/inquiry'

export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

// ─── GET /api/marketplace/listings/[id]/inquiries/me ──────────────────────────
// Returns the authenticated buyer's inquiry for this listing, or null.
// Does not require membership — buyer should always be able to check own status.

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const inquiry = await getMyInquiryForListing(params.id, user.id)

    return jsonOk({ inquiry: inquiry ? serializeInquiry(inquiry) : null })
  } catch (error) {
    console.error('[marketplace/listings/[id]/inquiries/me] GET failed', { error })
    if (isDbConnectionError(error)) return jsonError('SERVICE_UNAVAILABLE', '服务暂时不可用，请稍后重试。', 503)
    const prismaCode = (error as { code?: string }).code
    if (prismaCode === 'P2021' || prismaCode === 'P2022') return jsonOk({ inquiry: null })
    return jsonError('INQUIRY_FETCH_FAILED', '获取合作意向失败。', 500)
  }
}
