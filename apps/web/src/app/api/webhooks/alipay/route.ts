import { NextResponse } from 'next/server'
import { verifyAlipayNotify } from '@/lib/payments/alipay'
import { fulfillOrder } from '@/lib/credits/billing-client'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { valid, data } = await verifyAlipayNotify(req)
  if (!valid) return new NextResponse('fail', { status: 400 })
  if (data.trade_status !== 'TRADE_SUCCESS' && data.trade_status !== 'TRADE_FINISHED') {
    return new NextResponse('success')
  }
  try {
    await fulfillOrder({
      externalOrderId: data.out_trade_no,
      externalPaymentId: data.trade_no,
      rawNotifyJson: JSON.stringify(data),
    })
    return new NextResponse('success')
  } catch (err) {
    console.error('[webhooks/alipay]', err)
    return new NextResponse('fail', { status: 500 })
  }
}
