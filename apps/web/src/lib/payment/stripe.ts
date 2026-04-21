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
