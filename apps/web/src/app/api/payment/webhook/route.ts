import { NextRequest, NextResponse } from 'next/server'
import { lookupIntent } from '@/lib/payment/stripe'

/**
 * POST /api/payment/webhook
 *
 * Accepts a Stripe-shaped event. In production this would be called by Stripe
 * and verified with stripe.webhooks.constructEvent(rawBody, sig, secret).
 *
 * Body: {
 *   type: 'payment_intent.succeeded'
 *   data: { object: { id: string } }   // paymentIntentId
 * }
 *
 * Returns: { handled: true; action: 'mark_paid'; orderId: string }
 *        | { handled: false; reason: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      type?: string
      data?: { object?: { id?: string } }
    }

    if (body.type !== 'payment_intent.succeeded') {
      return NextResponse.json({ handled: false, reason: 'unhandled_event_type' })
    }

    const paymentIntentId = body.data?.object?.id
    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return NextResponse.json({ handled: false, reason: 'missing_payment_intent_id' }, { status: 400 })
    }

    const intent = lookupIntent(paymentIntentId)
    if (!intent) {
      return NextResponse.json({ handled: false, reason: 'intent_not_found' }, { status: 404 })
    }

    return NextResponse.json({
      handled: true,
      action:  'mark_paid',
      orderId: intent.orderId,
    })
  } catch (err) {
    console.error('[payment/webhook]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
