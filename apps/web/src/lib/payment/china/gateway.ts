import {
  closeAlipayChinaPayment,
  createAlipayChinaPayment,
  getAlipayChinaConfiguration,
  queryAlipayChinaPayment,
  refundAlipayChinaPayment,
  verifyAlipayChinaWebhook,
} from './alipay'
import { ChinaPaymentError } from './errors'
import type {
  ChinaPaymentConfiguration,
  ChinaPaymentCreateResult,
  ChinaPaymentOperationResult,
  ChinaPaymentProvider,
  ChinaPaymentQueryResult,
  ChinaPaymentWebhookResult,
  CreateChinaPaymentInput,
} from './types'
import {
  closeWeChatPayChinaPayment,
  createWeChatPayChinaPayment,
  getWeChatPayChinaConfiguration,
  queryWeChatPayChinaPayment,
  refundWeChatPayChinaPayment,
  verifyWeChatPayChinaWebhook,
} from './wechatpay'

export function getChinaPaymentConfigurations(): Record<ChinaPaymentProvider, ChinaPaymentConfiguration> {
  return {
    alipay: getAlipayChinaConfiguration(),
    wechatpay: getWeChatPayChinaConfiguration(),
  }
}

export async function createChinaPayment(input: CreateChinaPaymentInput): Promise<ChinaPaymentCreateResult> {
  switch (input.provider) {
    case 'alipay':
      return createAlipayChinaPayment(input)
    case 'wechatpay':
      return createWeChatPayChinaPayment(input)
    default:
      throw new ChinaPaymentError('PAYMENT_PROVIDER_UNSUPPORTED', '不支持的中国支付服务商。', 400)
  }
}

export async function verifyChinaPaymentWebhook(
  provider: ChinaPaymentProvider,
  request: Request,
): Promise<ChinaPaymentWebhookResult> {
  switch (provider) {
    case 'alipay':
      return verifyAlipayChinaWebhook(request)
    case 'wechatpay':
      return verifyWeChatPayChinaWebhook(request)
    default:
      throw new ChinaPaymentError('PAYMENT_PROVIDER_UNSUPPORTED', '不支持的中国支付服务商。', 400)
  }
}

export async function queryChinaPayment(provider: ChinaPaymentProvider, outTradeNo: string): Promise<ChinaPaymentQueryResult> {
  return provider === 'alipay'
    ? queryAlipayChinaPayment(outTradeNo)
    : queryWeChatPayChinaPayment(outTradeNo)
}

export async function closeChinaPayment(provider: ChinaPaymentProvider, outTradeNo: string): Promise<ChinaPaymentOperationResult> {
  return provider === 'alipay'
    ? closeAlipayChinaPayment(outTradeNo)
    : closeWeChatPayChinaPayment(outTradeNo)
}

export async function refundChinaPayment(
  provider: ChinaPaymentProvider,
  outTradeNo: string,
  refundAmountFen: number,
): Promise<ChinaPaymentOperationResult> {
  return provider === 'alipay'
    ? refundAlipayChinaPayment(outTradeNo, refundAmountFen)
    : refundWeChatPayChinaPayment(outTradeNo, refundAmountFen)
}
