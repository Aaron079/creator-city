// Safe logging helpers for cn-executor.
// Redacts credential / sensitive fields from log payloads to prevent
// API key / token leakage in Aliyun FC structured logs.
//
// Use sanitizeExecutorLogPayload() on any object before logging if it may
// contain fields derived from user input or provider responses.
// safeLogVideoJob() is the preferred wrapper for video job events.

const CREDENTIAL_KEYS = new Set([
  'apiKey', 'api_key', 'Authorization', 'authorization',
  'encryptedApiKey', 'encryptedFields',
  'userCredential', 'credential', 'credentials',
  'endpointId', 'endpoint_id',
  'password', 'secret', 'token',
  'accessKey', 'secretKey', 'access_key', 'secret_key',
])

export function redactCredentialFields(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (CREDENTIAL_KEYS.has(key)) {
      result[key] = '[REDACTED]'
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactCredentialFields(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}

export function sanitizeExecutorLogPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return redactCredentialFields(payload)
}

// Structured log helper for video job events.
// Automatically redacts credential fields from the payload.
// hasByokCredential must always be included — false until Video BYOK is enabled.
export function safeLogVideoJob(event: string, payload: Record<string, unknown>): void {
  console.log(`[cn-executor][videoJobRunner] ${event}`, sanitizeExecutorLogPayload(payload))
}
