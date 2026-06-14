import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { updateMembershipOrderVoucher, MembershipError } from '@/lib/membership/server'
import { jsonError, jsonOk } from '@/lib/api/json-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const { id: orderId } = params
    let voucherNote: string
    try {
      const body = await request.json()
      voucherNote = body?.voucherNote ?? ''
    } catch {
      return jsonError('VOUCHER_NOTE_REQUIRED', '请填写付款备注。', 400)
    }

    const order = await updateMembershipOrderVoucher(user.id, orderId, voucherNote)
    return jsonOk({ order })
  } catch (err) {
    if (err instanceof MembershipError) {
      const status = err.code === 'MEMBERSHIP_ORDER_NOT_FOUND' ? 404 : 400
      return jsonError(err.code, err.message, status)
    }
    console.error('[api/me/membership/orders/[id]] PATCH failed', err)
    return jsonError('MEMBERSHIP_ORDER_UPDATE_FAILED', '更新失败，请稍后重试。', 500)
  }
}
