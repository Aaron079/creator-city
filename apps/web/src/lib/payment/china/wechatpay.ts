import { ChinaPaymentError } from './errors'
import type {
  ChinaPaymentConfiguration,
  ChinaPaymentCreateResult,
  ChinaPaymentOperationResult,
  ChinaPaymentQueryResult,
  ChinaPaymentWebhookResult,
  CreateChinaPaymentInput,
} from './types'

const REQUIRED = [
  'WECHAT_PAY_APP_ID',
  'WECHAT_PAY_MCH_ID',
  'WECHAT_PAY_API_V3_KEY',
  'WECHAT_PAY_PRIVATE_KEY',
  'WECHAT_PAY_CERT_SERIAL_NO',
  'WECHAT_PAY_NOTIFY_URL',
] as const

export function getWeChatPayChinaConfiguration(): ChinaPaymentConfiguration {
  const missing = REQUIRED.filter((key) => !process.env[key])
  return {
    provider: 'wechatpay',
    configured: missing.length === 0,
    missing,
    mode: missing.length === 0 ? 'stub' : 'not-configured',
  }
}

export async function createWeChatPayChinaPayment(input: CreateChinaPaymentInput): Promise<ChinaPaymentCreateResult> {
  const config = getWeChatPayChinaConfiguration()
  if (!config.configured) {
    throw new ChinaPaymentError('PAYMENT_PROVIDER_NOT_CONFIGURED', '微信支付商户参数未配置。', 503, {
      provider: 'wechatpay',
      missing: config.missing,
    })
  }

  return {
    provider: 'wechatpay',
    outTradeNo: input.outTradeNo,
    qrCodeUrl: undefined,
    raw: {
      mode: 'stub',
      appidConfigured: Boolean(process.env.WECHAT_PAY_APP_ID),
      mchidConfigured: Boolean(process.env.WECHAT_PAY_MCH_ID),
      description: input.subject,
      amount: { total: input.amountCnyFen, currency: 'CNY' },
      notifyUrl: input.notifyUrl,
      clientType: input.clientType,
      tradeType: input.clientType === 'wechat-jsapi' ? 'JSAPI' : 'NATIVE',
      nextStep: 'Wire WeChat Pay v3 signing and /v3/pay/transactions/native before production traffic.',
    },
  }
}

export async function verifyWeChatPayChinaWebhook(request: Request): Promise<ChinaPaymentWebhookResult> {
  const config = getWeChatPayChinaConfiguration()
  const rawBody = await request.text()
  if (!config.configured) {
    return { provider: 'wechatpay', valid: false, paid: false, raw: rawBody, message: '微信支付商户参数未配置。' }
  }
  return {
    provider: 'wechatpay',
    valid: false,
    paid: false,
    raw: {
      body: rawBody,
      serial: request.headers.get('wechatpay-serial'),
      timestamp: request.headers.get('wechatpay-timestamp'),
      nonce: request.headers.get('wechatpay-nonce'),
    },
    message: '微信支付 webhook 验签占位中，接入平台证书验签与 AES-GCM 解密后才会入账。',
  }
}

export async function queryWeChatPayChinaPayment(outTradeNo: string): Promise<ChinaPaymentQueryResult> {
  const config = getWeChatPayChinaConfiguration()
  if (!config.configured) {
    throw new ChinaPaymentError('PAYMENT_PROVIDER_NOT_CONFIGURED', '微信支付商户参数未配置。', 503, {
      provider: 'wechatpay',
      missing: config.missing,
    })
  }
  return { provider: 'wechatpay', outTradeNo, status: 'unknown', raw: { mode: 'stub' } }
}

export async function closeWeChatPayChinaPayment(outTradeNo: string): Promise<ChinaPaymentOperationResult> {
  const config = getWeChatPayChinaConfiguration()
  if (!config.configured) {
    throw new ChinaPaymentError('PAYMENT_PROVIDER_NOT_CONFIGURED', '微信支付商户参数未配置。', 503, {
      provider: 'wechatpay',
      missing: config.missing,
    })
  }
  return { provider: 'wechatpay', outTradeNo, success: false, raw: { mode: 'stub' } }
}

export async function refundWeChatPayChinaPayment(outTradeNo: string, refundAmountFen: number): Promise<ChinaPaymentOperationResult> {
  const config = getWeChatPayChinaConfiguration()
  if (!config.configured) {
    throw new ChinaPaymentError('PAYMENT_PROVIDER_NOT_CONFIGURED', '微信支付商户参数未配置。', 503, {
      provider: 'wechatpay',
      missing: config.missing,
    })
  }
  return { provider: 'wechatpay', outTradeNo, success: false, raw: { mode: 'stub', refundAmountFen } }
}
