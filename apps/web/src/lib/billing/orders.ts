import { getCreditPackage } from './packages'
import { getApiBase, readJson } from './server-api'
import type { BillingRegion, PaymentOrder, PaymentProvider } from './types'

function normalizeStatus(status: string): PaymentOrder['status'] {
  return status.toLowerCase() as PaymentOrder['status']
}

export async function createPaymentOrder(input: {
  authToken: string
  packageId: string
  region: BillingRegion
  provider: PaymentProvider
}): Promise<PaymentOrder> {
  const pkg = getCreditPackage(input.packageId)
  if (!pkg) throw new Error('Package not found')
  const price = pkg.prices.find((p) => p.region === input.region && p.provider === input.provider)
  if (!price) throw new Error('Price not found for payment method')

  const creditsGranted = pkg.credits + pkg.bonusCredits
  const externalOrderId = `cc_${input.provider}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const res = await fetch(`${getApiBase()}/api/v1/credits/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.authToken}`,
    },
    body: JSON.stringify({
      packageId: input.packageId,
      region: input.region,
      provider: input.provider,
      currency: price.currency,
      amount: price.amount,
      externalOrderId,
      credits: creditsGranted,
      priceUSD: price.currency === 'USD' ? price.amount : Math.round(price.amount / Number(process.env.USD_CNY_RATE ?? 7.2)),
    }),
  })
  if (!res.ok) {
    const data = await readJson<{ message?: string; error?: string }>(res)
    throw new Error(data.message ?? data.error ?? `Order creation failed: ${res.status}`)
  }
  const order = await readJson<{
    id: string
    userId: string
    packageId?: string | null
    region?: string
    provider?: string
    status: string
    amount?: number
    currency?: string
    credits?: number
    externalOrderId?: string | null
    externalPaymentId?: string | null
    externalCustomerId?: string | null
    createdAt: string
    paidAt?: string | null
  }>(res)
  return {
    id: order.id,
    userId: order.userId,
    packageId: order.packageId,
    region: (order.region ?? input.region) as BillingRegion,
    provider: (order.provider ?? input.provider) as PaymentProvider,
    status: normalizeStatus(order.status),
    amount: order.amount ?? price.amount,
    currency: (order.currency ?? price.currency) as PaymentOrder['currency'],
    creditsGranted: order.credits ?? creditsGranted,
    externalOrderId: order.externalOrderId ?? externalOrderId,
    externalPaymentId: order.externalPaymentId,
    externalCustomerId: order.externalCustomerId,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
  }
}

export async function getPaymentOrder(): Promise<never> {
  throw new Error('Payment orders are read through admin billing APIs.')
}

export async function markPaymentOrderPaid(): Promise<never> {
  throw new Error('Payment orders can only be marked paid from verified webhooks.')
}

export async function markPaymentOrderFailed(): Promise<never> {
  throw new Error('Payment failures must be recorded by backend order APIs.')
}

export async function ensurePaymentIdempotency(externalPaymentId: string): Promise<boolean> {
  return Boolean(externalPaymentId)
}
