/**
 * Payment abstraction layer.
 *
 * Structure mirrors the real Stripe PaymentIntents API so this file can be
 * swapped for a live integration by:
 *   1. npm install stripe
 *   2. Replace createPaymentIntent body with:
 *        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
 *        return stripe.paymentIntents.create({ amount, currency, metadata })
 *   3. Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in .env
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled'

export interface PaymentIntent {
  id:           string          // pi_xxxx
  object:       'payment_intent'
  amount:       number          // in smallest currency unit (fen for CNY)
  currency:     string          // 'cny'
  status:       PaymentIntentStatus
  clientSecret: string          // pi_xxxx_secret_yyyy  (passed to Stripe.js on client)
  orderId:      string          // metadata reference
  createdAt:    number
}

export interface CreatePaymentIntentInput {
  orderId: string
  amount:  number   // in yuan (will be converted to fen)
  currency?: string
}

export interface CreatePaymentIntentResult {
  clientSecret:    string
  paymentIntentId: string
  amount:          number
  currency:        string
}

// ─── Intent registry (survives HMR via global singleton) ─────────────────────

const g = global as Record<string, unknown>
const intentRegistry: Map<string, PaymentIntent> =
  (g.__intentRegistry__ as Map<string, PaymentIntent> | undefined) ??
  (() => { g.__intentRegistry__ = new Map<string, PaymentIntent>(); return g.__intentRegistry__ as Map<string, PaymentIntent> })()

export function lookupIntent(id: string): PaymentIntent | undefined {
  return intentRegistry.get(id)
}

// ─── Mock implementation ──────────────────────────────────────────────────────

function mockId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Creates a PaymentIntent.
 *
 * Mock: returns a deterministic fake clientSecret.
 * Real: would call `stripe.paymentIntents.create(...)` server-side.
 */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<PaymentIntent> {
  const { orderId, amount, currency = 'cny' } = input

  // Simulate real Stripe network latency
  await new Promise((r) => setTimeout(r, 180))

  const id = mockId('pi_mock')
  const clientSecret = `${id}_secret_${mockId('sk')}`

  const intent: PaymentIntent = {
    id,
    object:      'payment_intent',
    amount:      Math.round(amount * 100),
    currency,
    status:      'requires_payment_method',
    clientSecret,
    orderId,
    createdAt:   Date.now(),
  }
  intentRegistry.set(id, intent)
  return intent
}

/**
 * Confirms a PaymentIntent (client-side, normally done via Stripe.js).
 *
 * Real implementation would call:
 *   stripe.confirmPayment({ elements, clientSecret, confirmParams })
 *
 * Mock: always resolves to 'succeeded' after a short delay.
 */
export async function confirmPaymentIntent(
  _clientSecret: string,
): Promise<{ status: PaymentIntentStatus }> {
  await new Promise((r) => setTimeout(r, 600))
  return { status: 'succeeded' }
}

// ─── Stripe Checkout / Webhook stubs ─────────────────────────────────────────

export interface CheckoutSessionInput {
  packageId: string
  packageName: string
  credits: number
  priceUSD: number
  orderId: string
  userId: string
  successUrl: string
  cancelUrl: string
}

export async function createCheckoutSession(
  input: CheckoutSessionInput,
): Promise<{ id: string; url: string | null }> {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY not configured')

  const body = new URLSearchParams({
    'mode': 'payment',
    'success_url': input.successUrl + `?session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url': input.cancelUrl,
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(input.priceUSD),
    'line_items[0][price_data][product_data][name]': `${input.packageName} (${input.credits} credits)`,
    'line_items[0][quantity]': '1',
    'metadata[orderId]': input.orderId,
    'metadata[userId]': input.userId,
    'metadata[packageId]': input.packageId,
  })

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } }
    throw new Error(err.error?.message ?? 'Stripe checkout session creation failed')
  }

  const session = await res.json() as { id: string; url: string | null }
  return session
}

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): Promise<{ valid: boolean; event: { type: string; data: { object: Record<string, unknown> } } | null }> {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) return { valid: false, event: null }

    const parts = signature.split(',')
    const ts = parts.find((p) => p.startsWith('t='))?.slice(2)
    const v1 = parts.find((p) => p.startsWith('v1='))?.slice(3)
    if (!ts || !v1) return { valid: false, event: null }

    const crypto = await import('crypto')
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${ts}.${rawBody}`)
      .digest('hex')

    if (expected !== v1) return { valid: false, event: null }

    const event = JSON.parse(rawBody) as { type: string; data: { object: Record<string, unknown> } }
    return { valid: true, event }
  } catch {
    return { valid: false, event: null }
  }
}
