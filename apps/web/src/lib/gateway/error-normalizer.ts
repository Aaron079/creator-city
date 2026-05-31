import type { GatewayErrorCode } from './types'

export type NormalizedProviderError = {
  errorCode: GatewayErrorCode
  message: string
  retryable: boolean
}

type RawError = {
  status?: number
  statusCode?: number
  code?: string
  message?: string
  errorCode?: string
}

function extractRaw(input: unknown): RawError {
  if (!input || typeof input !== 'object') return {}
  const e = input as Record<string, unknown>
  return {
    status: typeof e['status'] === 'number' ? e['status'] : typeof e['statusCode'] === 'number' ? e['statusCode'] : undefined,
    code: typeof e['code'] === 'string' ? e['code'] : typeof e['errorCode'] === 'string' ? e['errorCode'] : undefined,
    message: typeof e['message'] === 'string' ? e['message'] : undefined,
  }
}

function matchMessage(message: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(message))
}

/**
 * Maps a raw provider error (unknown shape) to a standardized GatewayErrorCode.
 * Never throws — always returns a normalized result.
 */
export function normalizeProviderError(input: unknown): NormalizedProviderError {
  const raw = extractRaw(input)
  const msg = (raw.message ?? (input instanceof Error ? input.message : String(input ?? ''))).toLowerCase()
  const status = raw.status
  const code = (raw.code ?? '').toLowerCase()

  // ── Not configured / missing key (check before auth to avoid false positives) ──
  if (
    code === 'provider_not_configured' ||
    matchMessage(msg, [/not configured|missing.*key|api.?key.*missing|env.*missing|provider.*disabled/i])
  ) {
    return { errorCode: 'PROVIDER_NOT_CONFIGURED', message: 'Provider is not configured on this server.', retryable: false }
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (status === 401 || status === 403 || matchMessage(msg, [/unauthorized|invalid api key|api key|forbidden|authentication/i])) {
    return { errorCode: 'PROVIDER_AUTH_FAILED', message: 'Provider authentication failed. Check server-side API key configuration.', retryable: false }
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  if (status === 429 || matchMessage(msg, [/rate.?limit|too many requests|quota exceeded|throttl/i])) {
    return { errorCode: 'PROVIDER_RATE_LIMITED', message: 'Provider rate limit reached. Request will be retried.', retryable: true }
  }

  // ── Timeout / network ─────────────────────────────────────────────────────
  if (
    status === 408 || status === 504 || status === 502 || status === 503 ||
    code === 'etimedout' || code === 'econnreset' || code === 'econnrefused' ||
    matchMessage(msg, [/timeout|timed out|network.*fail|connect.*fail|socket hang/i])
  ) {
    return { errorCode: 'PROVIDER_TIMEOUT', message: 'Provider request timed out or network error occurred.', retryable: true }
  }

  // ── Content policy / safety ───────────────────────────────────────────────
  if (matchMessage(msg, [/content.?policy|safety|moderat|nsfw|violat|inappropriate|harmful|rejected.*content/i])) {
    return { errorCode: 'PROVIDER_CONTENT_POLICY', message: 'Request rejected by provider content policy.', retryable: false }
  }

  // ── Insufficient credits / quota ──────────────────────────────────────────
  if (matchMessage(msg, [/insufficient.?credit|not enough credit|credit.*balance|quota.*insuffici|out of credit/i])) {
    return { errorCode: 'PROVIDER_INSUFFICIENT_CREDITS', message: 'Insufficient platform credits to complete this request.', retryable: false }
  }

  // ── Budget exceeded ───────────────────────────────────────────────────────
  if (matchMessage(msg, [/budget.*exceed|monthly.*limit|spend.*limit|billing.*limit/i])) {
    return { errorCode: 'PROVIDER_BUDGET_EXCEEDED', message: 'Provider monthly budget exceeded. Contact admin.', retryable: false }
  }

  // ── Bad request / invalid parameters ─────────────────────────────────────
  if (status === 400 || status === 422 || matchMessage(msg, [/invalid.*param|bad.?request|malformed|unsupported.*format/i])) {
    return { errorCode: 'PROVIDER_BAD_REQUEST', message: raw.message ?? 'Invalid request parameters.', retryable: false }
  }

  // ── Task cancelled ────────────────────────────────────────────────────────
  if (matchMessage(msg, [/cancel|abort/i])) {
    return { errorCode: 'PROVIDER_TASK_CANCELLED', message: 'Generation task was cancelled.', retryable: false }
  }

  // ── Default ───────────────────────────────────────────────────────────────
  return {
    errorCode: 'UNKNOWN_PROVIDER_ERROR',
    message: raw.message ?? (input instanceof Error ? input.message : 'An unknown provider error occurred.'),
    retryable: false,
  }
}
