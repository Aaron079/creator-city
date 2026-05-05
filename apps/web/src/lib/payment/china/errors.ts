export type ChinaPaymentErrorCode =
  | 'PAYMENT_PROVIDER_NOT_CONFIGURED'
  | 'PAYMENT_PROVIDER_NOT_IMPLEMENTED'
  | 'PAYMENT_PROVIDER_UNSUPPORTED'
  | 'PAYMENT_WEBHOOK_INVALID'
  | 'PAYMENT_REQUEST_FAILED'
  | 'ALIPAY_SIGN_FAILED'
  | 'ALIPAY_PRECREATE_FAILED'

export class ChinaPaymentError extends Error {
  code: ChinaPaymentErrorCode
  status: number
  details?: unknown

  constructor(code: ChinaPaymentErrorCode, message: string, status = 400, details?: unknown) {
    super(message)
    this.name = 'ChinaPaymentError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function isChinaPaymentError(error: unknown): error is ChinaPaymentError {
  return error instanceof ChinaPaymentError
}
