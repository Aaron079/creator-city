import type { CheckoutResult, PaymentOrder } from '@/lib/billing/types'
import type { PaymentConfiguration } from './types'
import { hmacSha256Hex, safeEqual } from './signature'

const REQUIRED = ['PADDLE_API_KEY', 'PADDLE_WEBHOOK_SECRET'] as const

export function getPaddleConfiguration(): PaymentConfiguration {
  const missing = REQUIRED.filter((key) => !process.env[key])
  return {
    enabled: process.env.PADDLE_ENABLED === 'true',
    configured: process.env.PADDLE_ENABLED === 'true' && missing.length === 0,
    missing,
  }
}

export async function createPaddleCheckout(order: PaymentOrder): Promise<CheckoutResult> {
  const config = getPaddleConfiguration()
  if (!config.configured) {
    return { status: 'not-configured', provider: 'paddle', orderId: order.id, message: 'Paddle 未配置' }
  }
  return {
    status: 'ready',
    provider: 'paddle',
    orderId: order.id,
    message: 'Paddle checkout payload 已创建',
    providerOrderPayload: {
      environment: process.env.PADDLE_ENVIRONMENT ?? 'sandbox',
      custom_data: { orderId: order.id, credits: order.creditsGranted },
      items: [{ quantity: 1, price: { amount: order.amount.toString(), currency_code: order.currency } }],
    },
  }
}

export function verifyPaddleWebhook(rawBody: string, signature: string | null): { valid: boolean; event?: Record<string, unknown> } {
  const secret = process.env.PADDLE_WEBHOOK_SECRET
  if (!secret || !signature) return { valid: false }
  const parts = Object.fromEntries(signature.split(';').map((part) => {
    const [key, value] = part.split('=')
    return [key, value]
  }))
  const timestamp = parts.ts
  const received = parts.h1
  if (!timestamp || !received) return { valid: false }
  const expected = hmacSha256Hex(secret, `${timestamp}:${rawBody}`)
  if (!safeEqual(expected, received)) return { valid: false }
  try {
    return { valid: true, event: JSON.parse(rawBody) as Record<string, unknown> }
  } catch {
    return { valid: false }
  }
}

export function handlePaddleTransactionCompleted(event: Record<string, unknown>) {
  const data = event.data as { id?: string; custom_data?: { orderId?: string }; customer_id?: string } | undefined
  return {
    orderId: data?.custom_data?.orderId,
    externalPaymentId: data?.id,
    externalCustomerId: data?.customer_id,
  }
}
