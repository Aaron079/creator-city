import { type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { submitMembershipOrder, MembershipError } from '@/lib/membership/server'
import { db } from '@/lib/db'
import { jsonError, jsonOk } from '@/lib/api/json-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const orders = await db.membershipOrder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        planCode: true,
        amountCny: true,
        periodMonths: true,
        voucherNote: true,
        adminNote: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return jsonOk({ orders })
  } catch (err) {
    console.error('[api/me/membership/orders] GET failed', err)
    return jsonError('INTERNAL_ERROR', '获取订单列表失败。', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    let voucherNote: string | undefined
    try {
      const body = await request.json()
      voucherNote = typeof body?.voucherNote === 'string' ? body.voucherNote : undefined
    } catch {
      // body is optional
    }

    const result = await submitMembershipOrder(user.id, { voucherNote })
    return jsonOk(result)
  } catch (err) {
    if (err instanceof MembershipError) {
      return jsonError(err.code, err.message, 400)
    }
    console.error('[api/me/membership/orders] POST failed', err)
    return jsonError('INTERNAL_ERROR', '提交会员申请失败。', 500)
  }
}
