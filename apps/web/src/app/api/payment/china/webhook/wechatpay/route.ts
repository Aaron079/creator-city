import { NextResponse } from 'next/server'
import { verifyChinaPaymentWebhook } from '@/lib/payment/china/gateway'
import { fulfillChinaPaymentOrder } from '@/lib/payment/china/settlement'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const result = await verifyChinaPaymentWebhook('wechatpay', request)
  if (!result.valid) return NextResponse.json({ code: 'FAIL', message: result.message ?? '验签失败' }, { status: 401 })
  if (!result.paid || !result.outTradeNo) return NextResponse.json({ code: 'SUCCESS', message: 'OK' })

  try {
    await fulfillChinaPaymentOrder({
      outTradeNo: result.outTradeNo,
      transactionId: result.transactionId,
      rawNotifyJson: result.raw,
    })
    return NextResponse.json({ code: 'SUCCESS', message: 'OK' })
  } catch (error) {
    console.error('[payment/china/webhook/wechatpay]', error)
    return NextResponse.json({ code: 'FAIL', message: '入账失败' }, { status: 500 })
  }
}
