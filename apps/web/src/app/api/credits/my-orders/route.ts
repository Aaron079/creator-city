import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { PaymentOrderStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: '请先登录' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')?.toUpperCase() as PaymentOrderStatus | undefined

  try {
    const orders = await db.paymentOrder.findMany({
      where: {
        userId: user.id,
        provider: 'manual',
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        amountCredits: o.credits,
        status: o.status,
        note: (o.rawNotifyJson as Record<string, unknown> | null)?.userNote ?? null,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
      })),
    })
  } catch (err) {
    console.error('[credits/my-orders]', err)
    return NextResponse.json({ message: '获取订单失败' }, { status: 500 })
  }
}
