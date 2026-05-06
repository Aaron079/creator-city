import { NextResponse } from 'next/server'
import { verifyChinaPaymentWebhook } from '@/lib/payment/china/gateway'
import { fulfillChinaPaymentOrder } from '@/lib/payment/china/settlement'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const result = await verifyChinaPaymentWebhook('alipay', request)
    if (!result.valid) return new NextResponse('fail', { status: 400 })
    if (!result.paid || !result.outTradeNo) return new NextResponse('success')

    const settlement = await fulfillChinaPaymentOrder({
      outTradeNo: result.outTradeNo,
      provider: 'alipay',
      transactionId: result.transactionId,
      rawPayload: result.raw,
      source: 'alipay_webhook',
    })
    if (!settlement.success) throw new Error(settlement.message)
    return new NextResponse('success')
  } catch (error) {
    console.error('[payment/china/webhook/alipay]', error)
    return new NextResponse('fail', { status: 500 })
  }
}
