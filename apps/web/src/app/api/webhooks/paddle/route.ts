import { NextRequest, NextResponse } from 'next/server'
import { handlePaddleTransactionCompleted, verifyPaddleWebhook } from '@/lib/payments/paddle'
import { fulfillOrder } from '@/lib/credits/billing-client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const { valid, event } = verifyPaddleWebhook(rawBody, req.headers.get('paddle-signature'))
  if (!valid || !event) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })

  if (event.event_type !== 'transaction.completed') {
    return NextResponse.json({ handled: false, reason: 'unhandled_event_type' })
  }

  const completed = handlePaddleTransactionCompleted(event)
  try {
    await fulfillOrder({
      orderId: completed.orderId,
      externalPaymentId: completed.externalPaymentId,
      rawNotifyJson: rawBody,
    })
    return NextResponse.json({ handled: true })
  } catch (err) {
    console.error('[webhooks/paddle]', err)
    return NextResponse.json({ error: 'Fulfillment failed' }, { status: 500 })
  }
}
