import { NextRequest, NextResponse } from 'next/server'
import { createPaymentIntent } from '@/lib/payment/stripe'

/**
 * POST /api/payment/create
 *
 * Body: { orderId: string; amount: number }
 *
 * Returns: { clientSecret: string; paymentIntentId: string; amount: number; currency: string }
 *
 * Real Stripe integration: replace createPaymentIntent with:
 *   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
 *   const intent = await stripe.paymentIntents.create({
 *     amount: Math.round(amount * 100),
 *     currency: 'cny',
 *     metadata: { orderId },
 *   })
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderId, amount } = body as { orderId?: string; amount?: number }

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }

    const intent = await createPaymentIntent({ orderId, amount })

    return NextResponse.json({
      clientSecret:    intent.clientSecret,
      paymentIntentId: intent.id,
      amount:          intent.amount,
      currency:        intent.currency,
    })
  } catch (err) {
    console.error('[payment/create]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
