import type { CheckoutResult, PaymentOrder } from '@/lib/billing/types'
import type { PaymentConfiguration } from './types'
import { verifyRsaSha256 } from './signature'

const REQUIRED = ['ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY', 'ALIPAY_GATEWAY_URL', 'ALIPAY_NOTIFY_URL'] as const

export function getAlipayConfiguration(): PaymentConfiguration {
  const missing = REQUIRED.filter((key) => !process.env[key])
  return {
    enabled: process.env.ALIPAY_ENABLED === 'true',
    configured: process.env.ALIPAY_ENABLED === 'true' && missing.length === 0,
    missing,
  }
}

export async function createAlipayCheckout(order: PaymentOrder): Promise<CheckoutResult> {
  const config = getAlipayConfiguration()
  if (!config.configured) {
    return { status: 'not-configured', provider: 'alipay', orderId: order.id, message: '支付宝未配置' }
  }
  return {
    status: 'ready',
    provider: 'alipay',
    orderId: order.id,
    message: '支付宝订单已创建',
    providerOrderPayload: {
      out_trade_no: order.externalOrderId ?? order.id,
      total_amount: (order.amount / 100).toFixed(2),
      subject: `Creator City Credits ${order.creditsGranted}`,
      notify_url: process.env.ALIPAY_NOTIFY_URL,
    },
  }
}

export async function parseAlipayNotify(request: Request): Promise<Record<string, string>> {
  const form = await request.formData()
  return Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]))
}

export async function verifyAlipayNotify(request: Request): Promise<{ valid: boolean; data: Record<string, string> }> {
  const data = await parseAlipayNotify(request)
  const config = getAlipayConfiguration()
  if (!config.configured || !data.sign) return { valid: false, data }
  const payload = Object.entries(data)
    .filter(([key]) => key !== 'sign' && key !== 'sign_type')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  return { valid: verifyRsaSha256(process.env.ALIPAY_PUBLIC_KEY!, payload, data.sign), data }
}
