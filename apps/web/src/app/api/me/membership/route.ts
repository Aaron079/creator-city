import { getCurrentUser } from '@/lib/auth/current-user'
import { getUserMembership } from '@/lib/membership/server'
import { jsonError, jsonOk } from '@/lib/api/json-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PLAN = {
  code: 'pro_monthly_cny100',
  amountCny: 10000,
  amountText: '¥100.00',
  periodMonths: 1,
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const ms = await getUserMembership(user.id)
    return jsonOk({
      membershipActive: ms.active,
      membershipStatus: ms.status,
      membershipExpiresAt: ms.expiresAt ? ms.expiresAt.toISOString() : null,
      membershipPlanCode: ms.planCode,
      daysRemaining: ms.daysRemaining,
      plan: PLAN,
    })
  } catch (err) {
    console.error('[api/me/membership] GET failed', err)
    return jsonError('INTERNAL_ERROR', '获取会员状态失败。', 500)
  }
}
