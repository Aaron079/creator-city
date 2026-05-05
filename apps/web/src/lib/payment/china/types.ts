export type ChinaPaymentProvider = 'alipay' | 'wechatpay'

export type ChinaPaymentClientType = 'pc' | 'h5' | 'wechat-jsapi'

export type ChinaPaymentMode = 'qr' | 'redirect' | 'form'

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
  success?: boolean
  provider: ChinaPaymentProvider
  outTradeNo: string
  mode?: ChinaPaymentMode
  qrCode?: string
  qrCodeUrl?: string
  paymentUrl?: string
  formHtml?: string
  prepayId?: string
  expiresAt?: string
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
