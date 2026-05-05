import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { getChinaPaymentConfigurations } from '@/lib/payment/china/gateway'
import { getChinaStorageConfigurations, getConfiguredChinaStorageProvider } from '@/lib/storage/china/gateway'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function jsonNoStore(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...init?.headers,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

export async function GET(request: NextRequest) {
  const outTradeNo = request.nextUrl.searchParams.get('outTradeNo')
  if (outTradeNo) {
    const user = await getCurrentUser()
    if (!user) return jsonNoStore({ message: '请先登录' }, { status: 401 })

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
    if (!order) return jsonNoStore({ status: 'FAILED', message: '订单不存在' }, { status: 404 })
    if (order.userId !== user.id && user.role !== 'ADMIN') {
      return jsonNoStore({ message: '无权查看该订单' }, { status: 403 })
    }

    return jsonNoStore({
      status: order.status,
      orderId: order.id,
      provider: order.provider,
      outTradeNo: order.externalOrderId,
      paidAt: order.paidAt,
      credits: order.credits,
    })
  }

  const payments = getChinaPaymentConfigurations()
  return jsonNoStore({
    success: true,
    providers: {
      alipay: {
        status: payments.alipay.configured ? 'configured' : 'not-configured',
        missing: payments.alipay.missing,
      },
      wechatpay: {
        status: payments.wechatpay.configured ? 'configured' : 'not-configured',
        missing: payments.wechatpay.missing,
      },
    },
    payments,
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
