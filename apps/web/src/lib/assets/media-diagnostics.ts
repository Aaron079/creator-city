export type MediaDiagnosticType = 'image' | 'video'

export type MediaUrlDiagnostic = {
  reachable: boolean
  status: number
  contentType?: string
  contentLength?: string
  expiredLikely: boolean
  message: string
}

const TEMPORARY_SIGNATURE_PATTERNS = [
  'x-tos-expires',
  'x-tos-signature',
  'x-tos-credential',
  'x-amz-expires',
  'x-amz-signature',
  'x-oss-expires',
  'x-oss-signature',
  'expires=',
  'signature=',
  'sign=',
  'security-token=',
]

const EXPIRED_BODY_PATTERNS = [
  'expired',
  'signaturedoesnotmatch',
  'accessdenied',
  'request has expired',
]

function looksLikeTemporarySignedUrl(url: string) {
  const lower = url.toLowerCase()
  return TEMPORARY_SIGNATURE_PATTERNS.some((pattern) => lower.includes(pattern))
}

function bodyLooksExpired(body: string) {
  const lower = body.toLowerCase()
  return EXPIRED_BODY_PATTERNS.some((pattern) => lower.includes(pattern))
}

function responseMessage(reachable: boolean, status: number, expiredLikely: boolean) {
  if (reachable) return '媒体 URL 当前可访问。'
  if (expiredLikely) return '媒体 URL 可能已过期或签名失效。'
  if (status > 0) return `媒体 URL 当前不可访问（HTTP ${status}）。`
  return '媒体 URL 当前不可访问。'
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    return await fetch(url, {
      ...init,
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function readFirstTextChunk(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('text') && !contentType.toLowerCase().includes('xml') && !contentType.toLowerCase().includes('json')) {
    return ''
  }
  if (!response.body) return ''
  const reader = response.body.getReader()
  try {
    const chunk = await reader.read()
    if (!chunk.value) return ''
    return new TextDecoder().decode(chunk.value).slice(0, 2048)
  } catch {
    return ''
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}

function diagnosticFromResponse(response: Response, url: string, bodyText = ''): MediaUrlDiagnostic {
  const status = response.status
  const reachable = status >= 200 && status < 400
  const expiredLikely = status === 403
    || status === 404
    || bodyLooksExpired(bodyText)
    || looksLikeTemporarySignedUrl(url)
  return {
    reachable,
    status,
    contentType: response.headers.get('content-type') ?? undefined,
    contentLength: response.headers.get('content-length') ?? undefined,
    expiredLikely,
    message: responseMessage(reachable, status, expiredLikely),
  }
}

export function validateMediaUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function isLikelyTemporaryMediaUrl(url: string) {
  return looksLikeTemporarySignedUrl(url)
}

export async function diagnoseMediaUrl(url: string): Promise<MediaUrlDiagnostic> {
  const trimmed = url.trim()
  if (!validateMediaUrl(trimmed)) {
    return {
      reachable: false,
      status: 0,
      expiredLikely: false,
      message: '媒体 URL 格式无效。',
    }
  }

  let headResponse: Response | null = null
  try {
    headResponse = await fetchWithTimeout(trimmed, { method: 'HEAD' })
    if (headResponse.ok || (headResponse.status !== 403 && headResponse.status !== 404 && headResponse.status !== 405)) {
      return diagnosticFromResponse(headResponse, trimmed)
    }
  } catch {
    headResponse = null
  }

  try {
    const getResponse = await fetchWithTimeout(trimmed, {
      method: 'GET',
      headers: { Range: 'bytes=0-1' },
    })
    const bodyText = getResponse.ok ? '' : await readFirstTextChunk(getResponse)
    return diagnosticFromResponse(getResponse, trimmed, bodyText)
  } catch (error) {
    const status = headResponse?.status ?? 0
    const expiredLikely = status === 403 || status === 404 || looksLikeTemporarySignedUrl(trimmed)
    return {
      reachable: false,
      status,
      contentType: headResponse?.headers.get('content-type') ?? undefined,
      contentLength: headResponse?.headers.get('content-length') ?? undefined,
      expiredLikely,
      message: error instanceof Error ? error.message : responseMessage(false, status, expiredLikely),
    }
  }
}
