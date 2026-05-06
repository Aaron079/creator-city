import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { fulfillChinaPaymentOrder } from '@/lib/payment/china/settlement'

export const dynamic = 'force-dynamic'

type SimulatePaidBody = {
  outTradeNo?: string
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, errorCode: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 })
  if (user.role !== 'ADMIN') return NextResponse.json({ success: false, errorCode: 'FORBIDDEN', message: '无权限' }, { status: 403 })

  if (process.env.PAYMENT_SANDBOX_SIMULATION_ENABLED !== 'true') {
    return NextResponse.json({
      success: false,
      errorCode: 'SIMULATION_DISABLED',
      message: '支付模拟未开启',
    }, { status: 403 })
  }

  let body: SimulatePaidBody
  try {
    body = await request.json() as SimulatePaidBody
  } catch {
    return NextResponse.json({ success: false, errorCode: 'VALIDATION_FAILED', message: 'Invalid JSON' }, { status: 400 })
  }

  const outTradeNo = body.outTradeNo?.trim()
  if (!outTradeNo) {
    return NextResponse.json({ success: false, errorCode: 'VALIDATION_FAILED', message: 'outTradeNo is required' }, { status: 400 })
  }

  const result = await fulfillChinaPaymentOrder({
    outTradeNo,
    provider: 'alipay',
    paidAt: new Date(),
    transactionId: `sandbox_${outTradeNo}`,
    rawPayload: {
      simulatedBy: user.id,
      simulatedAt: new Date().toISOString(),
    },
    source: 'sandbox_simulation',
  })

  if (!result.success) {
    return NextResponse.json(result, { status: result.errorCode === 'ORDER_NOT_FOUND' ? 404 : 409 })
  }

  return NextResponse.json({
    success: true,
    idempotent: result.idempotent,
    order: {
      id: result.order.id,
      outTradeNo: result.order.externalOrderId,
      status: result.order.status,
      credits: result.order.credits,
      paidAt: result.order.paidAt,
    },
    wallet: result.wallet
      ? {
          id: result.wallet.id,
          userId: result.wallet.userId,
          balance: result.wallet.balance,
          totalPurchased: result.wallet.totalPurchased,
        }
      : null,
    ledger: result.ledger
      ? {
          id: result.ledger.id,
          type: result.ledger.type,
          delta: result.ledger.delta,
          balance: result.ledger.balance,
        }
      : null,
  })
}
