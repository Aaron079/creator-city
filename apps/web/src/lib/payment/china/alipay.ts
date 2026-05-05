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

type AlipayPrecreatePayload = {
  code?: string
  msg?: string
  sub_code?: string
  sub_msg?: string
  out_trade_no?: string
  qr_code?: string
}

type AlipayPrecreateResponse = {
  alipay_trade_precreate_response?: AlipayPrecreatePayload
  error_response?: AlipayPrecreatePayload
  sign?: string
}

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

function buildSignContent(params: Record<string, string>, options?: { excludeSignType?: boolean }) {
  return Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && (!options?.excludeSignType || key !== 'sign_type') && value !== '')
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
  try {
    const signer = createSign('RSA-SHA256')
    signer.update(buildSignContent(params), 'utf8')
    signer.end()
    return signer.sign(normalizePrivateKey(privateKey), 'base64')
  } catch {
    throw new ChinaPaymentError(
      'ALIPAY_SIGN_FAILED',
      '支付宝签名失败，请检查应用私钥、支付宝公钥和 charset 配置。',
      500,
      { provider: 'alipay' },
    )
  }
}

function verifyAlipaySignature(params: Record<string, string>) {
  const publicKey = process.env.ALIPAY_PUBLIC_KEY
  if (!publicKey || !params.sign) return false
  try {
    const verifier = createVerify('RSA-SHA256')
    verifier.update(buildSignContent(params, { excludeSignType: true }), 'utf8')
    verifier.end()
    return verifier.verify(normalizePublicKey(publicKey), params.sign, 'base64')
  } catch {
    return false
  }
}

function getGateway() {
  return process.env.ALIPAY_GATEWAY ?? 'https://openapi.alipay.com/gateway.do'
}

function buildCommonParams(method: string, notifyUrl?: string): Record<string, string> {
  const params: Record<string, string> = {
    app_id: process.env.ALIPAY_APP_ID ?? '',
    method,
    format: 'json',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatAlipayTimestamp(),
    version: '1.0',
  }
  if (notifyUrl) params.notify_url = notifyUrl
  return params
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

function assertConfigured() {
  const config = getAlipayChinaConfiguration()
  if (!config.configured) {
    throw new ChinaPaymentError('PAYMENT_PROVIDER_NOT_CONFIGURED', '支付宝商户参数未配置。', 503, {
      provider: 'alipay',
      missing: config.missing,
    })
  }
}

async function postAlipayAop(params: Record<string, string>) {
  params.sign = signAlipayParams(params)
  const res = await fetch(getGateway(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      Accept: 'application/json',
    },
    body: new URLSearchParams(params).toString(),
    cache: 'no-store',
  })
  const text = await res.text()
  try {
    return JSON.parse(text) as AlipayPrecreateResponse
  } catch {
    throw new ChinaPaymentError('PAYMENT_REQUEST_FAILED', '支付宝返回了非 JSON 响应。', 502, {
      provider: 'alipay',
      status: res.status,
    })
  }
}

export async function createAlipayQrPayment(input: CreateChinaPaymentInput): Promise<ChinaPaymentCreateResult> {
  assertConfigured()

  const params = buildCommonParams('alipay.trade.precreate', input.notifyUrl)
  params.biz_content = JSON.stringify({
    out_trade_no: input.outTradeNo,
    total_amount: (input.amountCnyFen / 100).toFixed(2),
    subject: input.subject,
    product_code: 'FACE_TO_FACE_PAYMENT',
  })

  const raw = await postAlipayAop(params)
  const response = raw.alipay_trade_precreate_response ?? raw.error_response
  if (response?.code === '10000' && response.qr_code) {
    return {
      success: true,
      provider: 'alipay',
      mode: 'qr',
      outTradeNo: input.outTradeNo,
      qrCode: response.qr_code,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      raw: {
        code: response.code,
        msg: response.msg,
        outTradeNo: response.out_trade_no,
      },
    } as ChinaPaymentCreateResult & { success: true }
  }

  throw new ChinaPaymentError(
    'ALIPAY_PRECREATE_FAILED',
    response?.sub_msg || response?.msg || '支付宝预下单失败。',
    400,
    {
      provider: 'alipay',
      rawCode: response?.code,
      rawSubCode: response?.sub_code,
      rawMessage: response?.msg,
      rawSubMessage: response?.sub_msg,
    },
  )
}

export async function createAlipayChinaPayment(input: CreateChinaPaymentInput): Promise<ChinaPaymentCreateResult> {
  return createAlipayQrPayment(input)
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
  assertConfigured()
  return { provider: 'alipay', outTradeNo, status: 'unknown', raw: { mode: 'webhook-only' } }
}

export async function closeAlipayChinaPayment(outTradeNo: string): Promise<ChinaPaymentOperationResult> {
  assertConfigured()
  return { provider: 'alipay', outTradeNo, success: false, raw: { mode: 'not-implemented' } }
}

export async function refundAlipayChinaPayment(outTradeNo: string, refundAmountFen: number): Promise<ChinaPaymentOperationResult> {
  assertConfigured()
  return { provider: 'alipay', outTradeNo, success: false, raw: { mode: 'not-implemented', refundAmountFen } }
}
