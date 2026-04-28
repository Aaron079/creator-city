export const PROVIDER_ERROR_CODES = {
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
  PROVIDER_NOT_CONFIGURED: 'PROVIDER_NOT_CONFIGURED',
  ADAPTER_NOT_IMPLEMENTED: 'ADAPTER_NOT_IMPLEMENTED',
  PROVIDER_REQUEST_FAILED: 'PROVIDER_REQUEST_FAILED',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  INVALID_INPUT: 'INVALID_INPUT',
} as const

export type ProviderErrorCode = typeof PROVIDER_ERROR_CODES[keyof typeof PROVIDER_ERROR_CODES]

export class ProviderError extends Error {
  code: ProviderErrorCode
  constructor(code: ProviderErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'ProviderError'
  }
}
