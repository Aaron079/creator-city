import { createSign, createVerify } from 'crypto'
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
] as const

function normalizePrivateKey(value: string) {
  const key = value.replace(/\\n/g, '\n').trim()
  if (key.includes('BEGIN')) return key
  return `-----BEGIN PRIVATE KEY-----\n${key.match(/.{1,64}/g)?.join('\n') ?? key}\n-----END PRIVATE KEY-----`
}

function normalizePublicKey(value: string) {
  const key = value.replace(/\\n/g, '\n').trim()
  if (key.includes('BEGIN')) return key
  return `-----BEGIN PUBLIC KEY-----\n${key.match(/.{1,64}/g)?.join('\n') ?? key}\n-----END PUBLIC KEY-----`
}

function formatAlipayTimestamp(date = new Date()) {
  const chinaTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    chinaTime.getUTCFullYear(),
    pad(chinaTime.getUTCMonth() + 1),
    pad(chinaTime.getUTCDate()),
  ].join('-') + ' ' + [
    pad(chinaTime.getUTCHours()),
    pad(chinaTime.getUTCMinutes()),
    pad(chinaTime.getUTCSeconds()),
  ].join(':')
}

function buildSignContent(params: Record<string, string>) {
  return Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && key !== 'sign_type' && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

function signAlipayParams(params: Record<string, string>) {
  const privateKey = process.env.ALIPAY_PRIVATE_KEY
  if (!privateKey) {
    throw new ChinaPaymentError('PAYMENT_PROVIDER_NOT_CONFIGURED', '支付宝私钥未配置。', 503, {
      provider: 'alipay',
      missing: ['ALIPAY_PRIVATE_KEY'],
    })
  }
  const signer = createSign('RSA-SHA256')
  signer.update(buildSignContent(params), 'utf8')
  signer.end()
  return signer.sign(normalizePrivateKey(privateKey), 'base64')
}

function verifyAlipaySignature(params: Record<string, string>) {
  const publicKey = process.env.ALIPAY_PUBLIC_KEY
  if (!publicKey || !params.sign) return false
  try {
    const verifier = createVerify('RSA-SHA256')
    verifier.update(buildSignContent(params), 'utf8')
    verifier.end()
    return verifier.verify(normalizePublicKey(publicKey), params.sign, 'base64')
  } catch {
    return false
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildAutoSubmitForm(action: string, params: Record<string, string>) {
  const inputs = Object.entries(params)
    .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`)
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8" /></head><body><form id="alipay-submit-form" method="post" action="${escapeHtml(action)}">${inputs}</form><script>document.getElementById('alipay-submit-form').submit();</script></body></html>`
}

export function getAlipayChinaConfiguration(): ChinaPaymentConfiguration {
  const missing = REQUIRED.filter((key) => !process.env[key])
  return {
    provider: 'alipay',
    configured: missing.length === 0,
    missing,
    mode: missing.length === 0 ? 'ready' : 'not-configured',
  }
}

export function createAlipayPagePay(input: CreateChinaPaymentInput): ChinaPaymentCreateResult {
  const config = getAlipayChinaConfiguration()
  if (!config.configured) {
    throw new ChinaPaymentError('PAYMENT_PROVIDER_NOT_CONFIGURED', '支付宝商户参数未配置。', 503, {
      provider: 'alipay',
      missing: config.missing,
    })
  }

  const gateway = process.env.ALIPAY_GATEWAY ?? 'https://openapi.alipay.com/gateway.do'
  const params: Record<string, string> = {
    app_id: process.env.ALIPAY_APP_ID ?? '',
    method: 'alipay.trade.page.pay',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatAlipayTimestamp(),
    version: '1.0',
    notify_url: input.notifyUrl,
    biz_content: JSON.stringify({
      out_trade_no: input.outTradeNo,
      total_amount: (input.amountCnyFen / 100).toFixed(2),
      subject: input.subject,
      product_code: 'FAST_INSTANT_TRADE_PAY',
    }),
  }
  if (input.returnUrl) params.return_url = input.returnUrl
  params.sign = signAlipayParams(params)

  return {
    provider: 'alipay',
    outTradeNo: input.outTradeNo,
    formHtml: buildAutoSubmitForm(gateway, params),
    raw: {
      method: params.method,
      outTradeNo: input.outTradeNo,
      totalAmount: (input.amountCnyFen / 100).toFixed(2),
      clientType: input.clientType,
    },
  }
}

export async function createAlipayChinaPayment(input: CreateChinaPaymentInput): Promise<ChinaPaymentCreateResult> {
  return createAlipayPagePay(input)
}

export async function verifyAlipayChinaWebhook(request: Request): Promise<ChinaPaymentWebhookResult> {
  const config = getAlipayChinaConfiguration()
  const form = await request.formData()
  const data = Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]))
  if (!config.configured) {
    return { provider: 'alipay', valid: false, paid: false, raw: data, message: '支付宝商户参数未配置。' }
  }
  const valid = verifyAlipaySignature(data)
  if (!valid) {
    return {
      provider: 'alipay',
      valid: false,
      paid: false,
      outTradeNo: data.out_trade_no,
      transactionId: data.trade_no,
      raw: data,
      message: '支付宝 webhook 验签失败。',
    }
  }

  return {
    provider: 'alipay',
    valid: true,
    paid: data.trade_status === 'TRADE_SUCCESS' || data.trade_status === 'TRADE_FINISHED',
    outTradeNo: data.out_trade_no,
    transactionId: data.trade_no,
    raw: data,
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
