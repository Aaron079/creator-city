import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { getChinaPaymentConfigurations } from '@/lib/payment/china/gateway'
import { getChinaStorageConfigurations, getConfiguredChinaStorageProvider } from '@/lib/storage/china/gateway'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const outTradeNo = request.nextUrl.searchParams.get('outTradeNo')
  if (outTradeNo) {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ message: '请先登录' }, { status: 401 })

    const order = await db.paymentOrder.findUnique({
      where: { externalOrderId: outTradeNo },
      select: {
        id: true,
        userId: true,
        status: true,
        provider: true,
        externalOrderId: true,
        externalPaymentId: true,
        paidAt: true,
        credits: true,
      },
    })
    if (!order) return NextResponse.json({ status: 'FAILED', message: '订单不存在' }, { status: 404 })
    if (order.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ message: '无权查看该订单' }, { status: 403 })
    }

    return NextResponse.json({
      status: order.status,
      orderId: order.id,
      provider: order.provider,
      outTradeNo: order.externalOrderId,
      paidAt: order.paidAt,
      credits: order.credits,
    })
  }

  return NextResponse.json({
    success: true,
    payments: getChinaPaymentConfigurations(),
    storage: {
      activeProvider: getConfiguredChinaStorageProvider(),
      providers: getChinaStorageConfigurations(),
    },
    database: {
      active: 'DATABASE_URL',
      chinaReady: Boolean(process.env.DATABASE_URL_CN),
      migrationStatus: 'not-started',
    },
  })
}
