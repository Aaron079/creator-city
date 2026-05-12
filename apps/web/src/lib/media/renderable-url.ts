export type RenderableMediaUrlRejectReason =
  | 'invalid_url'
  | 'unsupported_protocol'
  | 'provider_api_endpoint'
  | 'not_media_candidate'

export type RenderableMediaUrlDecision =
  | {
      ok: true
      reason: 'media_extension' | 'oss_object_url' | 'cdn_media_url' | 'explicit_provider_media_field'
      hostname: string
      pathname: string
    }
  | {
      ok: false
      reason: RenderableMediaUrlRejectReason
      hostname?: string
      pathname?: string
      providerEndpoint?: string
    }

const MEDIA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.mov'])

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null
  } catch {
    return null
  }
}

function hasForbiddenApiPath(pathname: string) {
  const path = pathname.toLowerCase()
  return path === '/api'
    || path.startsWith('/api/')
    || path.includes('/api/')
    || path === '/v1'
    || path.startsWith('/v1/')
    || path.includes('/v1/')
    || path.includes('/v3/images/generations')
    || path.includes('/v3/contents/generations')
    || path === '/tasks'
    || path.startsWith('/tasks/')
    || path.includes('/tasks/')
}

function hasMediaExtension(pathname: string) {
  const path = pathname.toLowerCase()
  return [...MEDIA_EXTENSIONS].some((extension) => path.endsWith(extension))
}

function isOssObjectUrl(hostname: string, pathname: string) {
  const host = hostname.toLowerCase()
  if (!pathname || pathname === '/') return false
  return host.includes('.oss-')
    || host.includes('.oss.')
    || (host.endsWith('.aliyuncs.com') && host.includes('oss'))
    || ((host.endsWith('.volces.com') || host.endsWith('.volcengine.com')) && /(^|\.)tos[-.]/i.test(host))
}

function isCdnMediaUrl(hostname: string, pathname: string) {
  const host = hostname.toLowerCase()
  if (!pathname || pathname === '/') return false
  return host.endsWith('.byteimg.com')
    || host === 'byteimg.com'
    || host.endsWith('.bytecdn.cn')
    || host === 'bytecdn.cn'
    || host.includes('imagex')
    || host.includes('cdn')
}

function explicitProviderMediaField(source?: string) {
  const last = source
    ?.split('.')
    .pop()
    ?.replace(/\[\d+\]/g, '')
    .replace(/[_-]/g, '')
    .toLowerCase()
  return last === 'imageurl'
    || last === 'videourl'
    || last === 'mediaurl'
    || last === 'downloadurl'
    || last === 'url'
}

export function isProviderApiEndpointUrl(value: string) {
  const parsed = parseHttpUrl(value.trim())
  return Boolean(parsed && hasForbiddenApiPath(parsed.pathname))
}

export function isRenderableMediaUrl(value: string, options: { source?: string } = {}): RenderableMediaUrlDecision {
  const trimmed = value.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'invalid_url' }
  }

  const hostname = parsed.hostname.toLowerCase()
  const pathname = parsed.pathname
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'unsupported_protocol', hostname, pathname }
  }

  if (hasForbiddenApiPath(pathname)) {
    return { ok: false, reason: 'provider_api_endpoint', hostname, pathname, providerEndpoint: trimmed }
  }

  if (hasMediaExtension(pathname)) return { ok: true, reason: 'media_extension', hostname, pathname }
  if (isOssObjectUrl(hostname, pathname)) return { ok: true, reason: 'oss_object_url', hostname, pathname }
  if (isCdnMediaUrl(hostname, pathname)) return { ok: true, reason: 'cdn_media_url', hostname, pathname }
  if (explicitProviderMediaField(options.source)) return { ok: true, reason: 'explicit_provider_media_field', hostname, pathname }

  return { ok: false, reason: 'not_media_candidate', hostname, pathname }
}

export function filterRenderableMediaUrlSources<T extends { url: string; source?: string }>(candidates: T[]) {
  return candidates.filter((candidate) => isRenderableMediaUrl(candidate.url, { source: candidate.source }).ok)
}
