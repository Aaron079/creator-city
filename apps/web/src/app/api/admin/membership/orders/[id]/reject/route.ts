import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { rejectMembershipOrder, MembershipError } from '@/lib/membership/server'
import { jsonError, jsonOk } from '@/lib/api/json-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)
    if (user.role !== 'ADMIN') return jsonError('ADMIN_REQUIRED', '需要管理员权限。', 403)

    let adminNote = ''
    try {
      const body = await request.json()
      adminNote = typeof body?.adminNote === 'string' ? body.adminNote.trim() : ''
    } catch {
      // body parse failure — adminNote stays empty
    }

    const result = await rejectMembershipOrder(params.id, user.id, adminNote)
    return jsonOk({ order: result.order })
  } catch (err) {
    if (err instanceof MembershipError) {
      const status = err.code === 'MEMBERSHIP_ORDER_NOT_FOUND' ? 404 : 400
      return jsonError(err.code, err.message, status)
    }
    console.error('[api/admin/membership/orders/[id]/reject] POST failed', err)
    return jsonError('MEMBERSHIP_ADMIN_ACTION_FAILED', '拒绝操作失败，请稍后重试。', 500)
  }
}
