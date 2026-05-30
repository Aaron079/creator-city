import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { listManualOrders } from '@/lib/credits/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, errorCode: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ success: false, errorCode: 'FORBIDDEN', message: '无权限' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const statusParam = searchParams.get('status')?.toUpperCase()
  const status = (statusParam === 'PENDING' || statusParam === 'PAID' || statusParam === 'CANCELLED')
    ? statusParam
    : 'PENDING'
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 200)
  const offset = Number(searchParams.get('offset') ?? 0)

  try {
    const { orders, total } = await listManualOrders(status, limit, offset)
    return NextResponse.json({
      success: true,
      orders: orders.map((o) => ({
        id: o.id,
        externalOrderId: o.externalOrderId,
        userId: o.userId,
        userEmail: o.user?.email ?? null,
        userDisplayName: o.user?.displayName ?? null,
        credits: o.credits,
        amount: o.amount,
        currency: o.currency,
        status: o.status,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
        rawNotifyJson: o.rawNotifyJson,
      })),
      total,
    })
  } catch (err) {
    console.error('[GET /api/admin/payments/china]', err)
    return NextResponse.json({ success: false, errorCode: 'QUERY_FAILED', message: '查询失败' }, { status: 500 })
  }
}
