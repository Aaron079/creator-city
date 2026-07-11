import { isDbConnectionError } from '@/lib/db-error'

const DEFAULT_AUTH_DB_RETRY_DELAYS_MS = [150, 500, 1000]

export async function runAuthDbOperationWithRetry<T>(
  label: string,
  operation: () => Promise<T>,
  options: { retryDelaysMs?: number[] } = {},
): Promise<T> {
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_AUTH_DB_RETRY_DELAYS_MS
  let lastError: unknown

  for (let retryIndex = 0; retryIndex <= retryDelaysMs.length; retryIndex += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const retryDelayMs = retryDelaysMs[retryIndex]
      if (!isDbConnectionError(error) || retryDelayMs === undefined) {
        throw error
      }
      console.warn(`[auth/login] transient DB error during ${label}; retrying (${retryIndex + 1}/${retryDelaysMs.length})`)
      if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    }
  }

  throw lastError
}
