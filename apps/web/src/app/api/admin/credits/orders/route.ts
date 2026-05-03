import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { listManualOrders } from '@/lib/credits/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: '请先登录' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ message: '无权限' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')?.toUpperCase() as 'PENDING' | 'PAID' | 'CANCELLED' | undefined
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const offset = Number(searchParams.get('offset') ?? 0)

  try {
    const { orders, total } = await listManualOrders(status, limit, offset)
    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        userId: o.userId,
        user: o.user,
        amountCredits: o.credits,
        status: o.status,
        note: (o.rawNotifyJson as Record<string, unknown> | null)?.userNote ?? null,
        adminNote: (o.rawNotifyJson as Record<string, unknown> | null)?.approvalNote ??
          (o.rawNotifyJson as Record<string, unknown> | null)?.rejectionNote ?? null,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
      })),
      total,
    })
  } catch (err) {
    console.error('[admin/credits/orders]', err)
    return NextResponse.json({ message: '获取订单列表失败' }, { status: 500 })
  }
}
