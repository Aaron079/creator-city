export const VOLCENGINE_ARK_DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

export function imageEndpoint(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return /\/images\/generations$/i.test(base) ? base : `${base}/images/generations`
}

function getSeedreamEndpoint(): string {
  const baseUrl = process.env.VOLCENGINE_ARK_BASE_URL?.trim() || VOLCENGINE_ARK_DEFAULT_BASE_URL
  return imageEndpoint(baseUrl)
}

function looksLikeSeedreamUiProviderId(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized === 'volcengine-seedream-image'
    || normalized === 'volcengine_seedream_image'
    || normalized === 'volcengine_seedream'
}

function looksLikeSeedreamEndpointId(value: string): boolean {
  return /^ep-[a-z0-9][a-z0-9-]*$/i.test(value.trim())
}

function looksLikeSeedreamModelId(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (!normalized || looksLikeSeedreamUiProviderId(normalized) || looksLikeSeedreamEndpointId(normalized)) return false
  return /^(doubao-)?seedream-\d/.test(normalized)
}

export function getSeedreamConfigDebugPayload(): Record<string, unknown> {
  const model = process.env.VOLCENGINE_SEEDREAM_MODEL?.trim() ?? ''
  return {
    ok: true,
    provider: 'volcengine_seedream',
    endpoint: getSeedreamEndpoint(),
    model: {
      present: Boolean(model),
      valuePreview: model,
      looksLikeUiProviderId: Boolean(model) && looksLikeSeedreamUiProviderId(model),
      looksLikeModelId: Boolean(model) && looksLikeSeedreamModelId(model),
      looksLikeEndpointId: Boolean(model) && looksLikeSeedreamEndpointId(model),
    },
    expectedExamples: [
      'doubao-seedream-4-0-250828',
      'seedream-5-0-260128',
      'ep-xxxxxxxx',
    ],
    notes: [
      'model must be a Volcengine Ark image generation model ID or endpoint ID',
      'providerId such as volcengine-seedream-image is not valid as model',
    ],
  }
}

// Maps UI aspectRatio to Volcengine Seedream 5.0 WxH size string.
// All sizes must be >= 3,686,400 pixels (Seedream 5.0 minimum).
// Default (unknown/missing): 2560x1440 (exactly 3,686,400 px).
function normalizeSeedreamSize(aspectRatio?: string | null): string {
  const SEEDREAM_5_DEFAULT = '2560x1440'

  const ar = String(aspectRatio ?? '').trim().toLowerCase()

  // Pass through if already a valid WxH string — caller is responsible for pixel count
  if (/^\d{3,5}x\d{3,5}$/i.test(ar)) {
    const [w, h] = ar.split('x').map(Number)
    // Reject sizes below the 3,686,400 px minimum and fall to default
    if (w * h >= 3_686_400) return ar
  }

  // Seedream 5.0 sizes — all >= 3,686,400 pixels
  // 2560x1440 = 3,686,400  |  1440x2560 = 3,686,400
  // 2048x2048 = 4,194,304  |  2560x1920 = 4,915,200  |  1920x2560 = 4,915,200
  const sizeMap: Record<string, string> = {
    '16:9': '2560x1440',
    '9:16': '1440x2560',
    '1:1':  '2048x2048',
    '4:3':  '2560x1920',
    '3:4':  '1920x2560',
  }

  if (ar in sizeMap) return sizeMap[ar]

  // Any other ratio (2:3, 3:2, 21:9, 1080p, unknown…) → default
  return SEEDREAM_5_DEFAULT
}

function findImageUrl(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) || value.startsWith('data:image/')) return value
    return null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageUrl(item)
      if (found) return found
    }
    return null
  }
  if (typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const key of ['url', 'image_url', 'imageUrl', 'output_url', 'outputUrl']) {
    const found = findImageUrl(record[key])
    if (found) return found
  }
  for (const nested of Object.values(record)) {
    const found = findImageUrl(nested)
    if (found) return found
  }
  return null
}

function findBase64Image(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findBase64Image(item)
      if (found) return found
    }
    return null
  }
  const record = value as Record<string, unknown>
  for (const key of ['b64_json', 'base64', 'image_base64', 'imageBase64']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.length > 64) {
      return candidate.startsWith('data:image/') ? candidate : `data:image/png;base64,${candidate}`
    }
  }
  for (const nested of Object.values(record)) {
    const found = findBase64Image(nested)
    if (found) return found
  }
  return null
}

export type SeedreamInput = {
  prompt: string
  /** UI/provider identifier only — ignored for API model selection, always uses VOLCENGINE_SEEDREAM_MODEL env var */
  model?: string | null
  /** UI/provider identifier only — for submittedInput logging, never used as Volcengine model */
  providerId?: string | null
  aspectRatio?: string | null
  resolution?: string | null
}

export type SeedreamSuccess = {
  success: true
  model: string
  imageUrl: string
  dataUrl?: string
  isBase64: boolean
  providerOriginalUrl?: string
  providerEndpoint?: string
  submittedInput?: Record<string, unknown>
}

export type SeedreamError = {
  success: false
  errorCode: string
  message: string
  upstreamStatus?: number
  upstreamMessage?: string
  providerEndpoint?: string
  providerHttpStatus?: number
  requestId?: string
  submittedInput?: Record<string, unknown>
  providerResponse?: unknown
}

export type SeedreamResult = SeedreamSuccess | SeedreamError

function normalizeSeedreamErrorCode(status: number, message: string): string {
  const haystack = message.toLowerCase()
  if (status === 401) return 'provider_auth_failed'
  if (status === 403) {
    // 403 from Volcengine is usually a permission/quota issue, not an API-key problem.
    // Distinguish: quota/billing errors are reported separately from hard auth failures.
    if (/quota|余额|欠费|insufficient|billing|rate.?limit|limit.?exceed/.test(haystack)) return 'provider_quota_or_billing_error'
    // Feature permission (e.g. watermark, certain model features) → treat as invalid parameter
    if (/permission|forbidden|not.?allow|无权|not.?support/.test(haystack)) return 'provider_invalid_parameter'
    return 'provider_auth_failed'
  }
  if (
    status === 404
    || /model.*(not exist|not found|invalid|does not exist)|endpoint.*(not exist|not found|does not exist)|模型|接入点/.test(haystack)
  ) {
    return 'provider_model_invalid'
  }
  return 'provider_invalid_parameter'
}

export async function generateSeedreamImage(input: SeedreamInput): Promise<SeedreamResult> {
  const apiKey = process.env.VOLCENGINE_ARK_API_KEY?.trim()
  const endpoint = getSeedreamEndpoint()

  // Always use the env-var model — never trust the forwarded provider/display ID
  const model = process.env.VOLCENGINE_SEEDREAM_MODEL?.trim() ?? ''
  const size = normalizeSeedreamSize(input.aspectRatio)
  const submittedInput: Record<string, unknown> = {
    providerId: input.providerId ?? null,
    model,
    modelSource: 'VOLCENGINE_SEEDREAM_MODEL',
    size,
    aspectRatio: input.aspectRatio ?? null,
    resolution: input.resolution ?? null,
    promptChars: input.prompt.length,
    hasReferenceImages: false,
    referenceImageCount: 0,
  }

  if (!apiKey) {
    return {
      success: false,
      errorCode: 'provider_auth_failed',
      message: 'VOLCENGINE_ARK_API_KEY is not configured.',
      providerEndpoint: endpoint,
      submittedInput,
    }
  }
  if (!model) {
    return {
      success: false,
      errorCode: 'provider_invalid_parameter',
      message: 'VOLCENGINE_SEEDREAM_MODEL is not configured.',
      providerEndpoint: endpoint,
      submittedInput,
    }
  }

  // Minimal valid Volcengine ARK ImageGenerations body.
  // Do NOT include chat-only params (stream, sequential_image_generation, referenceImages, etc.).
  // watermark is intentionally omitted — it is a premium/account-specific feature that causes 403
  // on accounts without that permission, which maps to PROVIDER_AUTH_FAILED and masks the real error.
  const reqBody: Record<string, unknown> = {
    model,
    prompt: input.prompt,
    size,
    response_format: 'url',
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reqBody),
      signal: AbortSignal.timeout(55_000),
    })
  } catch (err) {
    return {
      success: false,
      errorCode: 'provider_fetch_failed',
      message: `Volcengine fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      providerEndpoint: endpoint,
      submittedInput,
    }
  }

  let data: unknown
  let raw: string
  try {
    raw = await response.text()
    data = JSON.parse(raw)
  } catch {
    return {
      success: false,
      errorCode: 'provider_invalid_response',
      message: `Volcengine returned HTTP ${response.status} with non-JSON body`,
      upstreamStatus: response.status,
      providerHttpStatus: response.status,
      providerEndpoint: endpoint,
      submittedInput,
    }
  }

  const requestId =
    response.headers.get('x-request-id') ??
    response.headers.get('x-tt-request-id') ??
    undefined

  if (!response.ok) {
    const errorData = typeof data === 'object' && data !== null
      ? (data as Record<string, unknown>)
      : {}
    const errorObj = errorData.error && typeof errorData.error === 'object'
      ? (errorData.error as Record<string, unknown>)
      : errorData
    const upstreamMessage =
      typeof errorObj.message === 'string'
        ? errorObj.message
        : raw.slice(0, 600)
    const bodyRequestId =
      typeof errorObj.request_id === 'string'
        ? errorObj.request_id
        : typeof errorData.request_id === 'string'
          ? errorData.request_id
          : undefined

    return {
      success: false,
      errorCode: normalizeSeedreamErrorCode(response.status, upstreamMessage),
      message: `Volcengine returned HTTP ${response.status}: ${upstreamMessage}`,
      upstreamStatus: response.status,
      upstreamMessage,
      providerEndpoint: endpoint,
      providerHttpStatus: response.status,
      requestId: requestId ?? bodyRequestId,
      submittedInput,
      providerResponse: errorData,
    }
  }

  const imageUrl = findImageUrl(data)
  const dataUrl = imageUrl?.startsWith('data:image/') ? imageUrl : findBase64Image(data) ?? undefined
  const finalUrl = imageUrl && !imageUrl.startsWith('data:image/') ? imageUrl : undefined

  if (finalUrl) {
    return {
      success: true,
      model,
      imageUrl: finalUrl,
      isBase64: false,
      providerOriginalUrl: finalUrl,
      providerEndpoint: endpoint,
      submittedInput,
    }
  }
  if (dataUrl) {
    return {
      success: true,
      model,
      imageUrl: dataUrl,
      dataUrl,
      isBase64: true,
      providerEndpoint: endpoint,
      submittedInput,
    }
  }

  return {
    success: false,
    errorCode: 'provider_no_download_url',
    message: 'Volcengine Seedream did not return an image URL or base64.',
    upstreamStatus: response.status,
    upstreamMessage: raw.slice(0, 500),
    providerEndpoint: endpoint,
    providerHttpStatus: response.status,
    requestId,
    submittedInput,
    providerResponse: data,
  }
}
