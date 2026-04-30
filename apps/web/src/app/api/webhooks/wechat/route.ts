import { NextResponse } from 'next/server'
import { decryptWeChatResource, verifyWeChatNotify } from '@/lib/payments/wechat'
import { fulfillOrder } from '@/lib/credits/billing-client'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { valid, rawBody } = await verifyWeChatNotify(req)
  if (!valid) return NextResponse.json({ code: 'FAIL', message: 'Invalid signature' }, { status: 401 })
  try {
    const payload = JSON.parse(rawBody) as {
      resource?: { associated_data?: string; nonce: string; ciphertext: string }
    }
    const decrypted = payload.resource ? decryptWeChatResource(payload.resource) : null
    if (!decrypted) return NextResponse.json({ code: 'FAIL', message: 'Decrypt failed' }, { status: 400 })
    const transaction = JSON.parse(decrypted) as {
      out_trade_no?: string
      transaction_id?: string
      trade_state?: string
    }
    if (transaction.trade_state !== 'SUCCESS') return NextResponse.json({ code: 'SUCCESS', message: 'ignored' })
    await fulfillOrder({
      externalOrderId: transaction.out_trade_no,
      externalPaymentId: transaction.transaction_id,
      rawNotifyJson: JSON.stringify(transaction),
    })
    return NextResponse.json({ code: 'SUCCESS', message: 'success' })
  } catch (err) {
    console.error('[webhooks/wechat]', err)
    return NextResponse.json({ code: 'FAIL', message: 'Fulfillment failed' }, { status: 500 })
  }
}
