import { createCheckoutSession, verifyWebhookSignature } from '@/lib/payment/stripe'
import type { CheckoutResult, PaymentOrder } from '@/lib/billing/types'
import type { PaymentConfiguration } from './types'

const REQUIRED = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] as const

export function getStripeConfiguration(): PaymentConfiguration {
  const missing = REQUIRED.filter((key) => !process.env[key])
  return {
    enabled: process.env.STRIPE_ENABLED === 'true',
    configured: process.env.STRIPE_ENABLED === 'true' && missing.length === 0,
    missing,
  }
}

export async function createStripeCheckout(order: PaymentOrder): Promise<CheckoutResult> {
  const config = getStripeConfiguration()
  if (!config.configured) {
    return { status: 'not-configured', provider: 'stripe', orderId: order.id, message: 'Stripe 未配置' }
  }
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
  const session = await createCheckoutSession({
    packageId: order.packageId ?? 'credits',
    packageName: 'Creator City Credits',
    credits: order.creditsGranted,
    priceUSD: order.currency === 'USD' ? order.amount : order.amount,
    orderId: order.id,
    userId: order.userId,
    successUrl: `${appUrl}/billing/success`,
    cancelUrl: `${appUrl}/billing/cancel`,
  })
  return {
    status: 'ready',
    provider: 'stripe',
    orderId: order.id,
    message: 'Stripe Checkout 已创建',
    checkoutUrl: session.url ?? undefined,
    providerOrderPayload: { sessionId: session.id },
  }
}

export async function verifyStripeWebhook(rawBody: string, signature: string) {
  return verifyWebhookSignature(rawBody, signature)
}

export function handleStripeCheckoutCompleted(event: { data: { object: { id: string; payment_intent?: string | null; payment_status?: string } } }) {
  const session = event.data.object
  return {
    externalOrderId: session.id,
    externalPaymentId: session.payment_intent ?? session.id,
    paid: session.payment_status === 'paid',
  }
}
