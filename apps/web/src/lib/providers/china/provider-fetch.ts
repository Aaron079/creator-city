export type ProviderFetchErrorCode =
  | 'provider_network_failed'
  | 'provider_timeout'
  | 'provider_auth_failed'
  | 'provider_invalid_parameter'
  | 'provider_model_invalid'
  | 'provider_response_parse_failed'

export type ProviderFetchFailure = {
  ok: false
  errorCode: ProviderFetchErrorCode
  errorMessage: string
  message: string
  providerEndpoint: string
  providerRequestMethod: string
  providerHttpStatus?: number
  upstreamMessage?: string
  rawCode?: string
  requestId?: string
  providerFetchError?: string
  providerFetchCause?: Record<string, unknown>
  submittedInput?: Record<string, unknown>
  providerResponse?: Record<string, unknown>
}

export type ProviderFetchSuccess<T = unknown> = {
  ok: true
  data: T
  raw: string
  response: Response
  providerEndpoint: string
  providerRequestMethod: string
  providerHttpStatus: number
  requestId?: string
  upstreamMessage?: string
}

type ProviderFetchOptions = Omit<RequestInit, 'signal'> & {
  timeoutMs?: number
  submittedInput?: Record<string, unknown>
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function responseRequestId(response: Response, data: unknown) {
  const record = recordValue(data)
  const error = recordValue(record.error)
  return stringValue(error.request_id)
    || stringValue(record.request_id)
    || response.headers.get('x-request-id')
    || response.headers.get('x-tt-logid')
    || response.headers.get('x-volc-request-id')
    || undefined
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function responseErrorCode(data: unknown) {
  const record = recordValue(data)
  const error = recordValue(record.error)
  return stringValue(error.code)
    || stringValue(record.code)
    || stringValue(error.type)
    || stringValue(record.type)
}

function responseErrorMessage(data: unknown, fallback: string) {
  const record = recordValue(data)
  const error = recordValue(record.error)
  return stringValue(error.message)
    || stringValue(record.message)
    || stringValue(record.error_message)
    || fallback
}

function providerResponseSummary(data: unknown, parseError?: string, rawSnippet?: string) {
  const record = recordValue(data)
  const error = recordValue(record.error)
  const content = recordValue(record.content)
  return {
    ...(parseError ? { parseError } : {}),
    ...(rawSnippet ? { rawSnippet } : {}),
    id: stringValue(record.id) || undefined,
    status: stringValue(record.status) || undefined,
    code: stringValue(record.code) || stringValue(error.code) || undefined,
    message: stringValue(record.message) || stringValue(error.message) || undefined,
    requestId: stringValue(record.request_id) || stringValue(error.request_id) || undefined,
    contentKeys: Object.keys(content).slice(0, 12),
    topLevelKeys: Object.keys(record).slice(0, 20),
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))
}

function errorCauseDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      name: 'UnknownError',
      message: String(error || 'Unknown provider fetch failure'),
    }
  }
  const cause = (error as Error & { cause?: unknown; code?: unknown }).cause
  const causeRecord = recordValue(cause)
  return {
    name: error.name,
    message: error.message,
    code: typeof (error as Error & { code?: unknown }).code === 'string' ? (error as Error & { code?: string }).code : undefined,
    causeName: cause instanceof Error ? cause.name : stringValue(causeRecord.name) || undefined,
    causeMessage: cause instanceof Error ? cause.message : stringValue(causeRecord.message) || (typeof cause === 'string' ? cause : undefined),
    causeCode: cause instanceof Error && typeof (cause as Error & { code?: unknown }).code === 'string'
      ? (cause as Error & { code?: string }).code
      : stringValue(causeRecord.code) || undefined,
  }
}

function providerFetchDetails(error: unknown) {
  const details = errorCauseDetails(error)
  return {
    providerFetchError: `${details.name}: ${details.message}`,
    providerFetchCause: details,
  }
}

function isModelInvalid(status: number, message: string, rawCode: string) {
  const haystack = `${rawCode} ${message}`.toLowerCase()
  return /model.*(not exist|not found|invalid|unavailable|not enabled|does not exist)|endpoint.*(not exist|not found|does not exist)|modelnotfound|model_not_found|invalidmodel|invalid_model/.test(haystack)
    || (status === 404 && /model|endpoint|接入点|模型/.test(haystack))
}

function classifyResponseError(status: number, message: string, rawCode: string): ProviderFetchErrorCode {
  const haystack = `${rawCode} ${message}`.toLowerCase()
  if (status === 401 || status === 403 || /auth|unauthorized|forbidden|permission|access denied|apikey\.invalid|invalid api key|api key is invalid/.test(haystack)) {
    return 'provider_auth_failed'
  }
  if (isModelInvalid(status, message, rawCode)) return 'provider_model_invalid'
  if (status === 400 || status === 422 || /invalid parameter|invalid_param|invalid request|bad request|parameter|unsupported|invalidinput|invalid_input/.test(haystack)) {
    return 'provider_invalid_parameter'
  }
  return 'provider_network_failed'
}

export async function providerFetch<T = unknown>(
  endpoint: string,
  options: ProviderFetchOptions = {},
): Promise<ProviderFetchSuccess<T> | ProviderFetchFailure> {
  const method = String(options.method || 'GET').toUpperCase()
  const { timeoutMs: requestedTimeoutMs, submittedInput, ...fetchOptions } = options
  const timeoutMs = requestedTimeoutMs ?? 60_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(endpoint, {
      ...fetchOptions,
      signal: controller.signal,
    })
    const raw = await response.text().catch(() => '')
    let data: unknown = {}
    if (raw.trim()) {
      try {
        data = JSON.parse(raw) as unknown
      } catch (error) {
        const fetchDetails = providerFetchDetails(error)
        return {
          ok: false,
          errorCode: 'provider_response_parse_failed',
          errorMessage: 'Provider returned an invalid JSON response.',
          message: 'Provider returned an invalid JSON response.',
          providerEndpoint: endpoint,
          providerRequestMethod: method,
          providerHttpStatus: response.status,
          upstreamMessage: raw.slice(0, 1000),
          requestId: response.headers.get('x-request-id') || response.headers.get('x-tt-logid') || undefined,
          ...fetchDetails,
          submittedInput,
          providerResponse: providerResponseSummary({}, 'invalid_json', raw.slice(0, 500)),
        }
      }
    }

    const requestId = responseRequestId(response, data)
    const upstreamMessage = responseErrorMessage(data, response.statusText || `HTTP ${response.status}`)
    const rawCode = responseErrorCode(data)
    if (!response.ok) {
      const errorCode = classifyResponseError(response.status, upstreamMessage, rawCode)
      return {
        ok: false,
        errorCode,
        errorMessage: upstreamMessage,
        message: upstreamMessage,
        providerEndpoint: endpoint,
        providerRequestMethod: method,
        providerHttpStatus: response.status,
        upstreamMessage: raw.trim() ? raw.slice(0, 1000) : upstreamMessage,
        rawCode,
        requestId,
        submittedInput,
        providerResponse: providerResponseSummary(data),
      }
    }

    return {
      ok: true,
      data: data as T,
      raw,
      response,
      providerEndpoint: endpoint,
      providerRequestMethod: method,
      providerHttpStatus: response.status,
      requestId,
      upstreamMessage: raw.trim() ? raw.slice(0, 1000) : undefined,
    }
  } catch (error) {
    const aborted = isAbortError(error)
    const fetchDetails = providerFetchDetails(error)
    return {
      ok: false,
      errorCode: aborted ? 'provider_timeout' : 'provider_network_failed',
      errorMessage: aborted
        ? `Provider request timed out after ${timeoutMs}ms.`
        : error instanceof Error ? error.message : 'Provider network request failed.',
      message: aborted
        ? `Provider request timed out after ${timeoutMs}ms.`
        : error instanceof Error ? error.message : 'Provider network request failed.',
      upstreamMessage: error instanceof Error ? error.message : undefined,
      providerEndpoint: endpoint,
      providerRequestMethod: method,
      ...fetchDetails,
      submittedInput,
    }
  } finally {
    clearTimeout(timer)
  }
}
