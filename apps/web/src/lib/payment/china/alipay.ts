import { ChinaPaymentError } from './errors'
import type {
  ChinaPaymentConfiguration,
  ChinaPaymentOperationResult,
  ChinaPaymentQueryResult,
  ChinaPaymentWebhookResult,
  CreateChinaPaymentInput,
  ChinaPaymentCreateResult,
} from './types'

const REQUIRED = [
  'ALIPAY_APP_ID',
  'ALIPAY_PRIVATE_KEY',
  'ALIPAY_PUBLIC_KEY',
  'ALIPAY_NOTIFY_URL',
] as const

export function getAlipayChinaConfiguration(): ChinaPaymentConfiguration {
  const missing = REQUIRED.filter((key) => !process.env[key])
  return {
    provider: 'alipay',
    configured: missing.length === 0,
    missing,
    mode: missing.length === 0 ? 'stub' : 'not-configured',
  }
}

export async function createAlipayChinaPayment(input: CreateChinaPaymentInput): Promise<ChinaPaymentCreateResult> {
  const config = getAlipayChinaConfiguration()
  if (!config.configured) {
    throw new ChinaPaymentError('PAYMENT_PROVIDER_NOT_CONFIGURED', '支付宝商户参数未配置。', 503, {
      provider: 'alipay',
      missing: config.missing,
    })
  }

  const gateway = process.env.ALIPAY_GATEWAY ?? 'https://openapi.alipay.com/gateway.do'
  return {
    provider: 'alipay',
    outTradeNo: input.outTradeNo,
    paymentUrl: gateway,
    raw: {
      mode: 'stub',
      gateway,
      appIdConfigured: Boolean(process.env.ALIPAY_APP_ID),
      subject: input.subject,
      totalAmount: (input.amountCnyFen / 100).toFixed(2),
      notifyUrl: input.notifyUrl,
      returnUrl: input.returnUrl,
      clientType: input.clientType,
      nextStep: 'Wire official Alipay RSA2 signing before production traffic.',
    },
  }
}

export async function verifyAlipayChinaWebhook(request: Request): Promise<ChinaPaymentWebhookResult> {
  const config = getAlipayChinaConfiguration()
  const form = await request.formData()
  const data = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]))
  if (!config.configured) {
    return { provider: 'alipay', valid: false, paid: false, raw: data, message: '支付宝商户参数未配置。' }
  }

  return {
    provider: 'alipay',
    valid: false,
    paid: false,
    outTradeNo: data.out_trade_no,
    transactionId: data.trade_no,
    raw: data,
    message: '支付宝 webhook 验签占位中，接入 RSA2 验签后才会入账。',
  }
}

export async function queryAlipayChinaPayment(outTradeNo: string): Promise<ChinaPaymentQueryResult> {
  const config = getAlipayChinaConfiguration()
  if (!config.configured) {
    throw new ChinaPaymentError('PAYMENT_PROVIDER_NOT_CONFIGURED', '支付宝商户参数未配置。', 503, {
      provider: 'alipay',
      missing: config.missing,
    })
  }
  return { provider: 'alipay', outTradeNo, status: 'unknown', raw: { mode: 'stub' } }
}

export async function closeAlipayChinaPayment(outTradeNo: string): Promise<ChinaPaymentOperationResult> {
  const config = getAlipayChinaConfiguration()
  if (!config.configured) {
    throw new ChinaPaymentError('PAYMENT_PROVIDER_NOT_CONFIGURED', '支付宝商户参数未配置。', 503, {
      provider: 'alipay',
      missing: config.missing,
    })
  }
  return { provider: 'alipay', outTradeNo, success: false, raw: { mode: 'stub' } }
}

export async function refundAlipayChinaPayment(outTradeNo: string, refundAmountFen: number): Promise<ChinaPaymentOperationResult> {
  const config = getAlipayChinaConfiguration()
  if (!config.configured) {
    throw new ChinaPaymentError('PAYMENT_PROVIDER_NOT_CONFIGURED', '支付宝商户参数未配置。', 503, {
      provider: 'alipay',
      missing: config.missing,
    })
  }
  return { provider: 'alipay', outTradeNo, success: false, raw: { mode: 'stub', refundAmountFen } }
}
