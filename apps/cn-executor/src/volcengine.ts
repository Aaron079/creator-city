const VOLCENGINE_ARK_DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

function imageEndpoint(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return /\/images\/generations$/i.test(base) ? base : `${base}/images/generations`
}

function normalizeSeedreamSize(input?: string | null): string {
  const value = String(input ?? '').toLowerCase()
  if (!value || value === '1080p' || value === '1920x1080' || value === '16:9') return '2K'
  if (value === '2k' || value === '2560x1440') return '2K'
  return input ?? '2K'
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
  model?: string | null
  aspectRatio?: string | null
}

export type SeedreamSuccess = {
  success: true
  model: string
  imageUrl: string
  dataUrl?: string
  isBase64: boolean
  providerOriginalUrl?: string
}

export type SeedreamError = {
  success: false
  errorCode: string
  message: string
  upstreamStatus?: number
  upstreamMessage?: string
}

export type SeedreamResult = SeedreamSuccess | SeedreamError

export async function generateSeedreamImage(input: SeedreamInput): Promise<SeedreamResult> {
  const apiKey = process.env.VOLCENGINE_ARK_API_KEY?.trim()
  const model = (input.model?.trim() || process.env.VOLCENGINE_SEEDREAM_MODEL?.trim()) ?? ''
  const baseUrl = process.env.VOLCENGINE_ARK_BASE_URL?.trim() || VOLCENGINE_ARK_DEFAULT_BASE_URL
  const endpoint = imageEndpoint(baseUrl)

  if (!apiKey) {
    return { success: false, errorCode: 'provider_auth_failed', message: 'VOLCENGINE_ARK_API_KEY is not configured.' }
  }
  if (!model) {
    return { success: false, errorCode: 'provider_invalid_parameter', message: 'VOLCENGINE_SEEDREAM_MODEL is not configured.' }
  }

  const size = normalizeSeedreamSize(input.aspectRatio)
  const body = {
    model,
    prompt: input.prompt,
    size,
    response_format: 'url',
    sequential_image_generation: 'disabled',
    stream: false,
    watermark: false,
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(65_000),
    })
  } catch (err) {
    return {
      success: false,
      errorCode: 'provider_fetch_failed',
      message: `Volcengine fetch failed: ${err instanceof Error ? err.message : String(err)}`,
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
    }
  }

  if (!response.ok) {
    const msg = typeof data === 'object' && data !== null
      ? JSON.stringify((data as Record<string, unknown>).error ?? data).slice(0, 400)
      : raw.slice(0, 400)
    return {
      success: false,
      errorCode: response.status === 401 || response.status === 403 ? 'provider_auth_failed' : 'provider_fetch_failed',
      message: `Volcengine returned HTTP ${response.status}: ${msg}`,
      upstreamStatus: response.status,
      upstreamMessage: msg,
    }
  }

  const imageUrl = findImageUrl(data)
  const dataUrl = imageUrl?.startsWith('data:image/') ? imageUrl : findBase64Image(data) ?? undefined
  const finalUrl = imageUrl && !imageUrl.startsWith('data:image/') ? imageUrl : undefined

  if (finalUrl) {
    return { success: true, model, imageUrl: finalUrl, isBase64: false, providerOriginalUrl: finalUrl }
  }
  if (dataUrl) {
    return { success: true, model, imageUrl: dataUrl, dataUrl, isBase64: true }
  }

  return {
    success: false,
    errorCode: 'provider_no_download_url',
    message: 'Volcengine Seedream did not return an image URL or base64.',
    upstreamStatus: response.status,
    upstreamMessage: raw.slice(0, 500),
  }
}
