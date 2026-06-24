import { NextRequest, NextResponse } from 'next/server'
import { PaymentOrderStatus } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getCreditPackage } from '@/lib/billing/packages'
import { db } from '@/lib/db'
import {
  assertPlatformCreditsRechargeEnabled,
  getOrCreateWallet,
  getPlatformCreditsRechargeDisabledPayload,
} from '@/lib/credits/server'
import { createChinaPayment } from '@/lib/payment/china/gateway'
import { isChinaPaymentError } from '@/lib/payment/china/errors'
import type { ChinaPaymentProvider } from '@/lib/payment/china/types'

export const dynamic = 'force-dynamic'

type CreateBody = {
  provider?: ChinaPaymentProvider
  packageId?: string
  clientType?: 'pc' | 'h5' | 'wechat-jsapi'
}

type ChinaPaymentErrorDetails = {
  rawCode?: string
  rawSubCode?: string
  rawMessage?: string
  rawSubMessage?: string
}

const PAYMENT_IDEMPOTENCY_HEADERS = [
  'Idempotency-Key',
  'X-Idempotency-Key',
  'X-Creator-Request-Id',
] as const

function normalizeIdempotencyKey(value: string | null) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed || trimmed.length > 200) return null
  return trimmed
}

function getPaymentIdempotencyKey(request: NextRequest, userId: string) {
  for (const header of PAYMENT_IDEMPOTENCY_HEADERS) {
    const value = normalizeIdempotencyKey(request.headers.get(header))
    if (value) return `payment-order:${userId}:${value}`
  }
  return null
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: unknown }).code === 'P2002',
  )
}

function getAppUrl(request: NextRequest) {
  return process.env.APP_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? `${request.nextUrl.protocol}//${request.nextUrl.host}`
}

function getNotifyUrl(provider: ChinaPaymentProvider, appUrl: string) {
  if (provider === 'alipay') {
    return process.env.ALIPAY_NOTIFY_URL || `${appUrl}/api/payment/china/webhook/alipay`
  }
  return process.env.WECHAT_PAY_NOTIFY_URL || `${appUrl}/api/payment/china/webhook/wechatpay`
}

function getErrorDetails(details: unknown): ChinaPaymentErrorDetails {
  if (!details || typeof details !== 'object') return {}
  const record = details as Record<string, unknown>
  return {
    rawCode: typeof record.rawCode === 'string' ? record.rawCode : undefined,
    rawSubCode: typeof record.rawSubCode === 'string' ? record.rawSubCode : undefined,
    rawMessage: typeof record.rawMessage === 'string' ? record.rawMessage : undefined,
    rawSubMessage: typeof record.rawSubMessage === 'string' ? record.rawSubMessage : undefined,
  }
}

export async function POST(request: NextRequest) {
  try {
    assertPlatformCreditsRechargeEnabled()
  } catch (error) {
    const disabled = getPlatformCreditsRechargeDisabledPayload(error)
    if (disabled) return NextResponse.json(disabled, { status: 503 })
    throw error
  }

  let user
  try {
    user = await getCurrentUser()
  } catch (error) {
    console.error('[payment/china/create/auth]', error)
    return NextResponse.json({ success: false, errorCode: 'AUTH_LOOKUP_FAILED', message: '读取登录状态失败' }, { status: 500 })
  }
  if (!user) return NextResponse.json({ success: false, errorCode: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 })

  let body: CreateBody
  try {
    body = await request.json() as CreateBody
  } catch {
    return NextResponse.json({ success: false, errorCode: 'VALIDATION_FAILED', message: 'Invalid JSON' }, { status: 400 })
  }

  if (body.provider !== 'alipay' && body.provider !== 'wechatpay') {
    return NextResponse.json({ success: false, errorCode: 'VALIDATION_FAILED', message: '请选择支付宝或微信支付' }, { status: 400 })
  }
  if (!body.packageId) {
    return NextResponse.json({ success: false, errorCode: 'VALIDATION_FAILED', message: 'packageId is required' }, { status: 400 })
  }

  const pkg = getCreditPackage(body.packageId)
  if (!pkg) return NextResponse.json({ success: false, errorCode: 'PACKAGE_NOT_FOUND', message: '套餐不存在' }, { status: 404 })

  const billingProvider = body.provider === 'wechatpay' ? 'wechat' : 'alipay'
  const price = pkg.prices.find((item) => item.region === 'CN' && item.provider === billingProvider)
  if (!price) {
    return NextResponse.json({ success: false, errorCode: 'PRICE_NOT_FOUND', message: '该套餐暂不支持中国支付' }, { status: 400 })
  }

  const credits = pkg.credits + pkg.bonusCredits
  let orderId: string | null = null
  let createdOrderThisRequest = false

  try {
    const wallet = await getOrCreateWallet(user.id)
    const idempotencyKey = getPaymentIdempotencyKey(request, user.id)
    const dbPackage = await db.creditPackage.findUnique({ where: { id: pkg.id }, select: { id: true } }).catch(() => null)
    let order = idempotencyKey
      ? await db.paymentOrder.findUnique({ where: { idempotencyKey } }).catch(() => null)
      : null
    let outTradeNo = order?.externalOrderId ?? `cc_cn_${body.provider}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    if (order) {
      if (
        order.userId !== user.id
        || order.provider !== body.provider
        || order.currency !== 'CNY'
        || order.amount !== price.amount
        || order.credits !== credits
      ) {
        return NextResponse.json({ success: false, errorCode: 'PAYMENT_IDEMPOTENCY_CONFLICT', message: '该支付幂等键已用于不同订单' }, { status: 409 })
      }
      if (order.status === PaymentOrderStatus.PAID) {
        return NextResponse.json({
          success: true,
          orderId: order.id,
          provider: body.provider,
          outTradeNo,
          amountCnyFen: price.amount,
          packageName: pkg.name,
          credits,
          status: order.status,
        })
      }
      if (order.status !== PaymentOrderStatus.PENDING) {
        return NextResponse.json({ success: false, errorCode: 'PAYMENT_ORDER_NOT_REUSABLE', message: `订单状态不可复用：${order.status}` }, { status: 409 })
      }
    } else {
      try {
        order = await db.paymentOrder.create({
          data: {
            userId: user.id,
            walletId: wallet.id,
            packageId: dbPackage?.id ?? null,
            region: 'CN',
            provider: body.provider,
            currency: 'CNY',
            amount: price.amount,
            externalOrderId: outTradeNo,
            idempotencyKey,
            status: PaymentOrderStatus.PENDING,
            credits,
            priceUSD: Math.round(price.amount / Number(process.env.USD_CNY_RATE ?? 7.2)),
            rawNotifyJson: {
              source: 'china-payment-gateway',
              packageId: pkg.id,
              packageName: pkg.name,
              checkoutMode: body.provider === 'alipay' ? 'qr' : 'native',
            },
          },
        })
        createdOrderThisRequest = true
      } catch (error) {
        if (!idempotencyKey || !isUniqueConstraintError(error)) throw error
        order = await db.paymentOrder.findUnique({ where: { idempotencyKey } })
        if (!order) throw error
        outTradeNo = order.externalOrderId ?? outTradeNo
        if (
          order.userId !== user.id
          || order.provider !== body.provider
          || order.currency !== 'CNY'
          || order.amount !== price.amount
          || order.credits !== credits
        ) {
          return NextResponse.json({ success: false, errorCode: 'PAYMENT_IDEMPOTENCY_CONFLICT', message: '该支付幂等键已用于不同订单' }, { status: 409 })
        }
      }
    }
    if (!order) throw new Error('PAYMENT_ORDER_CREATE_FAILED')
    orderId = order.id

    const appUrl = getAppUrl(request)
    const payment = await createChinaPayment({
      provider: body.provider,
      orderId: order.id,
      outTradeNo,
      subject: `Creator City Credits ${credits}`,
      amountCnyFen: price.amount,
      userId: user.id,
      notifyUrl: getNotifyUrl(body.provider, appUrl),
      clientType: body.clientType ?? 'pc',
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      provider: body.provider,
      mode: payment.mode ?? (payment.qrCode ? 'qr' : undefined),
      outTradeNo,
      qrCode: payment.qrCode,
      qrCodeUrl: payment.qrCodeUrl,
      amountCnyFen: price.amount,
      packageName: pkg.name,
      credits,
      expiresAt: payment.expiresAt,
      paymentUrl: body.provider === 'wechatpay' ? payment.paymentUrl : undefined,
      prepayId: payment.prepayId,
    })
  } catch (error) {
    if (orderId && createdOrderThisRequest) {
      await db.paymentOrder.update({
        where: { id: orderId },
        data: {
          status: PaymentOrderStatus.FAILED,
          rawNotifyJson: {
            source: 'china-payment-gateway',
            packageId: pkg.id,
            packageName: pkg.name,
            createError: isChinaPaymentError(error) ? error.code : 'CREATE_PAYMENT_FAILED',
          },
        },
      }).catch(() => null)
    }

    if (isChinaPaymentError(error)) {
      const details = getErrorDetails(error.details)
      const status = error.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED'
        ? 400
        : error.code === 'ALIPAY_PRECREATE_FAILED' || error.code === 'ALIPAY_NON_JSON_RESPONSE'
          ? 502
          : error.status
      return NextResponse.json({
        success: false,
        errorCode: error.code,
        message: error.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED' && body.provider === 'alipay'
          ? '支付宝未配置'
          : error.message,
        rawCode: details.rawCode,
        rawSubCode: details.rawSubCode,
        rawMessage: details.rawMessage,
        rawSubMessage: details.rawSubMessage,
      }, { status })
    }
    console.error('[payment/china/create]', error)
    return NextResponse.json({ success: false, errorCode: 'PAYMENT_CREATE_FAILED', message: '创建中国支付订单失败' }, { status: 500 })
  }
}
