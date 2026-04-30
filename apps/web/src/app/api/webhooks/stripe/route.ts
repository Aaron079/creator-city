import { NextRequest, NextResponse } from 'next/server'
import { verifyStripeWebhook } from '@/lib/payments/stripe'
import { fulfillOrder } from '@/lib/credits/billing-client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''
  const { valid, event } = await verifyStripeWebhook(rawBody, signature)
  if (!valid || !event) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ handled: false, reason: 'unhandled_event_type' })
  }

  const session = event.data.object as {
    id: string
    payment_intent?: string | null
    payment_status?: string
    metadata?: { orderId?: string }
  }
  if (session.payment_status !== 'paid') {
    return NextResponse.json({ handled: false, reason: 'payment_not_completed' })
  }

  try {
    await fulfillOrder({
      orderId: session.metadata?.orderId,
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent ?? undefined,
      externalPaymentId: session.payment_intent ?? session.id,
      rawNotifyJson: rawBody,
    })
    return NextResponse.json({ handled: true })
  } catch (err) {
    console.error('[webhooks/stripe]', err)
    return NextResponse.json({ error: 'Fulfillment failed' }, { status: 500 })
  }
}
