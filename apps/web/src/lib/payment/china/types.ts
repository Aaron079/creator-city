export type ChinaPaymentProvider = 'alipay' | 'wechatpay'

export type ChinaPaymentClientType = 'pc' | 'h5' | 'wechat-jsapi'

export type CreateChinaPaymentInput = {
  provider: ChinaPaymentProvider
  orderId: string
  outTradeNo: string
  subject: string
  amountCnyFen: number
  userId: string
  returnUrl?: string
  notifyUrl: string
  clientType: ChinaPaymentClientType
}

export type ChinaPaymentCreateResult = {
  provider: ChinaPaymentProvider
  outTradeNo: string
  paymentUrl?: string
  qrCodeUrl?: string
  formHtml?: string
  prepayId?: string
  raw?: unknown
}

export type ChinaPaymentWebhookResult = {
  provider: ChinaPaymentProvider
  valid: boolean
  paid: boolean
  outTradeNo?: string
  transactionId?: string
  raw?: unknown
  message?: string
}

export type ChinaPaymentQueryResult = {
  provider: ChinaPaymentProvider
  outTradeNo: string
  status: 'pending' | 'paid' | 'closed' | 'refunded' | 'unknown'
  raw?: unknown
}

export type ChinaPaymentOperationResult = {
  provider: ChinaPaymentProvider
  outTradeNo: string
  success: boolean
  raw?: unknown
}

export type ChinaPaymentConfiguration = {
  provider: ChinaPaymentProvider
  configured: boolean
  missing: string[]
  mode: 'not-configured' | 'stub' | 'ready'
}
