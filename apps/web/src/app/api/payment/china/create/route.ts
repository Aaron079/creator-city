import { NextRequest, NextResponse } from 'next/server'
import { PaymentOrderStatus } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getCreditPackage } from '@/lib/billing/packages'
import { db } from '@/lib/db'
import { getOrCreateWallet } from '@/lib/credits/server'
import { createChinaPayment } from '@/lib/payment/china/gateway'
import { isChinaPaymentError } from '@/lib/payment/china/errors'
import type { ChinaPaymentProvider } from '@/lib/payment/china/types'

export const dynamic = 'force-dynamic'

type CreateBody = {
  provider?: ChinaPaymentProvider
  packageId?: string
  clientType?: 'pc' | 'h5' | 'wechat-jsapi'
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

function getReturnUrl(provider: ChinaPaymentProvider, appUrl: string, outTradeNo: string) {
  if (provider === 'alipay') return process.env.ALIPAY_RETURN_URL || `${appUrl}/account/credits?outTradeNo=${encodeURIComponent(outTradeNo)}`
  return `${appUrl}/billing/success`
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
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
  if (!pkg) return NextResponse.json({ success: false, errorCode: 'PACKAGE_NOT_FOUND', message: '积分套餐不存在' }, { status: 404 })

  const billingProvider = body.provider === 'wechatpay' ? 'wechat' : 'alipay'
  const price = pkg.prices.find((item) => item.region === 'CN' && item.provider === billingProvider)
  if (!price) {
    return NextResponse.json({ success: false, errorCode: 'PRICE_NOT_FOUND', message: '该套餐暂不支持中国支付' }, { status: 400 })
  }

  const credits = pkg.credits + pkg.bonusCredits
  const wallet = await getOrCreateWallet(user.id)
  const outTradeNo = `cc_cn_${body.provider}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  try {
    const dbPackage = await db.creditPackage.findUnique({ where: { id: pkg.id }, select: { id: true } }).catch(() => null)
    const order = await db.paymentOrder.create({
      data: {
        userId: user.id,
        walletId: wallet.id,
        packageId: dbPackage?.id ?? null,
        region: 'CN',
        provider: body.provider,
        currency: 'CNY',
        amount: price.amount,
        externalOrderId: outTradeNo,
        status: PaymentOrderStatus.PENDING,
        credits,
        priceUSD: Math.round(price.amount / Number(process.env.USD_CNY_RATE ?? 7.2)),
        rawNotifyJson: {
          source: 'china-payment-gateway',
          packageId: pkg.id,
          packageName: pkg.name,
        },
      },
    })

    const appUrl = getAppUrl(request)
    const payment = await createChinaPayment({
      provider: body.provider,
      orderId: order.id,
      outTradeNo,
      subject: `Creator City Credits ${credits}`,
      amountCnyFen: price.amount,
      userId: user.id,
      notifyUrl: getNotifyUrl(body.provider, appUrl),
      returnUrl: getReturnUrl(body.provider, appUrl, outTradeNo),
      clientType: body.clientType ?? (body.provider === 'wechatpay' ? 'pc' : 'pc'),
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      provider: body.provider,
      outTradeNo,
      amountCnyFen: price.amount,
      credits,
      paymentUrl: payment.paymentUrl,
      qrCodeUrl: payment.qrCodeUrl,
      formHtml: payment.formHtml,
      prepayId: payment.prepayId,
      raw: payment.raw,
    })
  } catch (error) {
    if (isChinaPaymentError(error)) {
      return NextResponse.json({
        success: false,
        errorCode: error.code,
        message: error.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED' && body.provider === 'alipay'
          ? '支付宝未配置'
          : error.message,
        details: error.details,
      }, { status: error.status })
    }
    console.error('[payment/china/create]', error)
    return NextResponse.json({ success: false, errorCode: 'CREATE_PAYMENT_FAILED', message: '创建中国支付订单失败' }, { status: 500 })
  }
}
