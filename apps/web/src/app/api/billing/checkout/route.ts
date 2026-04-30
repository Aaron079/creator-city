import { NextRequest, NextResponse } from 'next/server'
import { createPaymentOrder } from '@/lib/billing/orders'
import { choosePaymentProvider, createCheckout } from '@/lib/billing/payment-router'
import { extractBearerToken } from '@/lib/credits/jwt-decode'
import type { BillingRegion, PaymentProvider } from '@/lib/billing/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = extractBearerToken(req.headers.get('authorization'))
  if (!token) return NextResponse.json({ error: 'Unauthorized', message: '请先登录后购买积分' }, { status: 401 })

  let body: { packageId?: string; region?: BillingRegion; paymentMethod?: PaymentProvider }
  try {
    body = await req.json() as { packageId?: string; region?: BillingRegion; paymentMethod?: PaymentProvider }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.packageId || !body.region || !body.paymentMethod) {
    return NextResponse.json({ error: 'INVALID_INPUT', message: 'packageId, region and paymentMethod are required' }, { status: 400 })
  }

  try {
    const provider = choosePaymentProvider(body.region, body.paymentMethod)
    const order = await createPaymentOrder({ authToken: token, packageId: body.packageId, region: body.region, provider })
    const checkout = await createCheckout(order)
    if (checkout.status === 'not-configured') {
      return NextResponse.json({ ...checkout, status: 'not-configured', message: '该支付方式尚未配置' }, { status: 200 })
    }
    return NextResponse.json(checkout)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed'
    const status = message.includes('not available') || message.includes('not found') ? 400 : 503
    return NextResponse.json({ error: 'CHECKOUT_FAILED', message }, { status })
  }
}
