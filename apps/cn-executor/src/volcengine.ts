const VOLCENGINE_ARK_DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

function imageEndpoint(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return /\/images\/generations$/i.test(base) ? base : `${base}/images/generations`
}

// Maps UI aspectRatio to the Volcengine Seedream WxH size string.
// Seedream only accepts specific WxH values — never raw UI strings like "9:16".
// Always defaults to high-res (2K) sizes; fallback is "1920x1080".
function normalizeSeedreamSize(aspectRatio?: string | null): string {
  const ar = String(aspectRatio ?? '').trim().toLowerCase()

  // Pass through if already WxH format
  if (/^\d{3,5}x\d{3,5}$/i.test(ar)) return ar

  // Seedream-supported sizes keyed by aspect ratio
  const sizeMap: Record<string, string> = {
    '16:9':  '1920x1080',
    '9:16':  '1080x1920',
    '1:1':   '2048x2048',
    '4:3':   '2048x1536',
    '3:4':   '1536x2048',
    '2:3':   '1365x2048',
    '3:2':   '2048x1365',
    '21:9':  '2560x1088',
  }

  if (ar in sizeMap) return sizeMap[ar]

  // Legacy aliases
  if (ar === '1080p') return '1920x1080'
  if (ar === '720p')  return '1280x720'

  // Default — widest support
  return '1920x1080'
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

export async function generateSeedreamImage(input: SeedreamInput): Promise<SeedreamResult> {
  const apiKey = process.env.VOLCENGINE_ARK_API_KEY?.trim()
  const baseUrl = process.env.VOLCENGINE_ARK_BASE_URL?.trim() || VOLCENGINE_ARK_DEFAULT_BASE_URL
  const endpoint = imageEndpoint(baseUrl)

  // Always use the env-var model — never trust the forwarded provider/display ID
  const model = process.env.VOLCENGINE_SEEDREAM_MODEL?.trim() ?? ''

  if (!apiKey) {
    return {
      success: false,
      errorCode: 'provider_auth_failed',
      message: 'VOLCENGINE_ARK_API_KEY is not configured.',
      providerEndpoint: endpoint,
    }
  }
  if (!model) {
    return {
      success: false,
      errorCode: 'provider_invalid_parameter',
      message: 'VOLCENGINE_SEEDREAM_MODEL is not configured.',
      providerEndpoint: endpoint,
    }
  }

  const size = normalizeSeedreamSize(input.aspectRatio)

  // Minimal valid Volcengine ARK ImageGenerations body.
  // Do NOT include chat-only params (stream, sequential_image_generation, referenceImages, etc.).
  const reqBody: Record<string, unknown> = {
    model,
    prompt: input.prompt,
    size,
    response_format: 'url',
    watermark: false,
  }

  const submittedInput: Record<string, unknown> = {
    providerId: input.providerId ?? null,
    model,
    size,
    aspectRatio: input.aspectRatio ?? null,
    resolution: input.resolution ?? null,
    promptChars: input.prompt.length,
    hasReferenceImages: false,
    referenceImageCount: 0,
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
      signal: AbortSignal.timeout(65_000),
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
      errorCode:
        response.status === 401 || response.status === 403
          ? 'provider_auth_failed'
          : 'provider_invalid_parameter',
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
