import { createAlipayCheckout, getAlipayConfiguration } from '@/lib/payments/alipay'
import { createPaddleCheckout, getPaddleConfiguration } from '@/lib/payments/paddle'
import { createStripeCheckout, getStripeConfiguration } from '@/lib/payments/stripe'
import { createWeChatNativeOrder, getWeChatPayConfiguration } from '@/lib/payments/wechat'
import type { BillingRegion, CheckoutResult, PaymentOrder, PaymentProvider } from './types'

export function choosePaymentProvider(region: BillingRegion, paymentMethod: PaymentProvider): PaymentProvider {
  if (region === 'CN' && ['alipay', 'wechat', 'manual'].includes(paymentMethod)) return paymentMethod
  if (region === 'GLOBAL' && ['stripe', 'paddle'].includes(paymentMethod)) return paymentMethod
  throw new Error('Payment method is not available for this region')
}

export function getProviderStatuses() {
  return {
    alipay: getAlipayConfiguration(),
    wechat: getWeChatPayConfiguration(),
    stripe: getStripeConfiguration(),
    paddle: getPaddleConfiguration(),
    manual: {
      enabled: process.env.MANUAL_RECHARGE_ENABLED !== 'false',
      configured: process.env.MANUAL_RECHARGE_ENABLED !== 'false',
      missing: [] as string[],
    },
  }
}

export async function createCheckout(order: PaymentOrder): Promise<CheckoutResult> {
  switch (order.provider) {
    case 'alipay':
      return createAlipayCheckout(order)
    case 'wechat':
      return createWeChatNativeOrder(order)
    case 'stripe':
      return createStripeCheckout(order)
    case 'paddle':
      return createPaddleCheckout(order)
    case 'manual':
      return {
        status: 'pending',
        provider: 'manual',
        orderId: order.id,
        message: '人工充值订单已创建，管理员确认到账后发放积分。',
        providerOrderPayload: {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          credits: order.creditsGranted,
        },
      }
  }
}
