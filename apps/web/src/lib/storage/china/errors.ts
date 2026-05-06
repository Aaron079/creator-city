export type ChinaStorageErrorCode =
  | 'STORAGE_NOT_CONFIGURED'
  | 'STORAGE_PROVIDER_UNSUPPORTED'
  | 'STORAGE_PROVIDER_NOT_IMPLEMENTED'
  | 'STORAGE_OPERATION_NOT_IMPLEMENTED'
  | 'STORAGE_OPERATION_FAILED'

export class ChinaStorageError extends Error {
  code: ChinaStorageErrorCode
  status: number
  details?: unknown

  constructor(code: ChinaStorageErrorCode, message: string, status = 400, details?: unknown) {
    super(message)
    this.name = 'ChinaStorageError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function isChinaStorageError(error: unknown): error is ChinaStorageError {
  return error instanceof ChinaStorageError
}
