import { createDecipheriv } from 'crypto'
import type { CheckoutResult, PaymentOrder } from '@/lib/billing/types'
import type { PaymentConfiguration } from './types'
import { verifyRsaSha256 } from './signature'

const REQUIRED = [
  'WECHAT_PAY_MCH_ID',
  'WECHAT_PAY_APP_ID',
  'WECHAT_PAY_API_V3_KEY',
  'WECHAT_PAY_PRIVATE_KEY',
  'WECHAT_PAY_CERT_SERIAL_NO',
  'WECHAT_PAY_PLATFORM_PUBLIC_KEY',
  'WECHAT_PAY_NOTIFY_URL',
] as const

export function getWeChatPayConfiguration(): PaymentConfiguration {
  const missing = REQUIRED.filter((key) => !process.env[key])
  return {
    enabled: process.env.WECHAT_PAY_ENABLED === 'true',
    configured: process.env.WECHAT_PAY_ENABLED === 'true' && missing.length === 0,
    missing,
  }
}

export async function createWeChatNativeOrder(order: PaymentOrder): Promise<CheckoutResult> {
  const config = getWeChatPayConfiguration()
  if (!config.configured) {
    return { status: 'not-configured', provider: 'wechat', orderId: order.id, message: '微信支付未配置' }
  }
  return {
    status: 'ready',
    provider: 'wechat',
    orderId: order.id,
    message: '微信支付 Native 订单已创建',
    providerOrderPayload: {
      appid: process.env.WECHAT_PAY_APP_ID,
      mchid: process.env.WECHAT_PAY_MCH_ID,
      out_trade_no: order.externalOrderId ?? order.id,
      description: `Creator City Credits ${order.creditsGranted}`,
      notify_url: process.env.WECHAT_PAY_NOTIFY_URL,
      amount: { total: order.amount, currency: order.currency },
    },
  }
}

export async function verifyWeChatNotify(request: Request): Promise<{ valid: boolean; rawBody: string }> {
  const rawBody = await request.text()
  const config = getWeChatPayConfiguration()
  const serial = request.headers.get('wechatpay-serial')
  const signature = request.headers.get('wechatpay-signature')
  const timestamp = request.headers.get('wechatpay-timestamp')
  const nonce = request.headers.get('wechatpay-nonce')
  if (!config.configured || !serial || !signature || !timestamp || !nonce) return { valid: false, rawBody }
  const payload = `${timestamp}\n${nonce}\n${rawBody}\n`
  return { valid: verifyRsaSha256(process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY!, payload, signature), rawBody }
}

export function decryptWeChatResource(input: { associated_data?: string; nonce: string; ciphertext: string }): string | null {
  const key = process.env.WECHAT_PAY_API_V3_KEY
  if (!key) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(input.nonce))
    if (input.associated_data) decipher.setAAD(Buffer.from(input.associated_data))
    const encrypted = Buffer.from(input.ciphertext, 'base64')
    const tag = encrypted.subarray(encrypted.length - 16)
    const data = encrypted.subarray(0, encrypted.length - 16)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
