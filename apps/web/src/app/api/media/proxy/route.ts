import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { CurrentUser } from '@/lib/auth/current-user'
import { getSessionToken } from '@/lib/auth/cookies'
import { hashToken } from '@/lib/auth/session'
import { isRenderableMediaUrl } from '@/lib/media/renderable-url'

// Module-level session cache — reduces pgBouncer pressure from concurrent video Range requests.
// A single video stream triggers 10-15 parallel Range requests; without caching, each hits the DB.
// TTL of 60s is well within the 30-day session lifetime and safe for read-only media access.
const PROXY_SESSION_CACHE_TTL_MS = 60_000
const proxySessionCache = new Map<string, { user: CurrentUser | null; expiresAt: number }>()

function getCachedProxySession(tokenHash: string): CurrentUser | null | undefined {
  const entry = proxySessionCache.get(tokenHash)
  if (!entry) return undefined
  if (entry.expiresAt < Date.now()) {
    proxySessionCache.delete(tokenHash)
    return undefined
  }
  return entry.user
}

function setCachedProxySession(tokenHash: string, user: CurrentUser | null) {
  if (proxySessionCache.size > 500) {
    const now = Date.now()
    for (const [k, v] of proxySessionCache) {
      if (v.expiresAt < now) proxySessionCache.delete(k)
    }
  }
  proxySessionCache.set(tokenHash, { user, expiresAt: Date.now() + PROXY_SESSION_CACHE_TTL_MS })
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_CONTENT_PREFIXES = ['image/', 'video/', 'audio/']
const DEFAULT_ALLOWED_HOST_SUFFIXES = [
  'aliyuncs.com',
  'volces.com',
  'volcengine.com',
  'byteimg.com',
  'bytecdn.cn',
]

type ProxyErrorCode =
  | 'proxy_url_missing'
  | 'proxy_url_not_allowed'
  | 'proxy_url_not_media_candidate'
  | 'proxy_auth_required'
  | 'proxy_upstream_403'
  | 'proxy_upstream_404'
  | 'proxy_fetch_failed'
  | 'proxy_timeout'

function isAllowedContentType(contentType: string | null) {
  if (!contentType) return false
  const lower = contentType.toLowerCase()
  return ALLOWED_CONTENT_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

function isPrivateHost(hostname: string) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true
  if (/^10\./.test(h)) return true
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)) return true
  if (/^192\.168\./.test(h)) return true
  if (/^169\.254\./.test(h)) return true
  if (h.endsWith('.local') || h.endsWith('.internal')) return true
  return false
}

function envList(name: string) {
  return (process.env[name] ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function hostnameFromValue(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return ''
  try {
    return new URL(trimmed).hostname.toLowerCase()
  } catch {
    try {
      return new URL(`https://${trimmed}`).hostname.toLowerCase()
    } catch {
      return ''
    }
  }
}

function configuredAllowedHosts() {
  const hosts = [
    hostnameFromValue(process.env.ALIYUN_OSS_ENDPOINT),
    hostnameFromValue(process.env.ALIYUN_OSS_PUBLIC_BASE_URL),
    hostnameFromValue(process.env.VOLCENGINE_ARK_BASE_URL),
    hostnameFromValue(process.env.CUSTOM_VIDEO_PROVIDER_ENDPOINT),
    hostnameFromValue(process.env.CREATOR_VIDEO_GATEWAY_ENDPOINT),
    hostnameFromValue(process.env.CUSTOM_PROVIDER_ENDPOINT),
    hostnameFromValue(process.env.SCENE_PLUGIN_ENDPOINT),
    ...envList('MEDIA_PROXY_ALLOWED_HOSTS').map(hostnameFromValue),
  ].filter(Boolean)
  return [...new Set(hosts)]
}

function configuredAllowedSuffixes() {
  return [...new Set([...DEFAULT_ALLOWED_HOST_SUFFIXES, ...envList('MEDIA_PROXY_ALLOWED_HOST_SUFFIXES')].map((host) => host.toLowerCase().replace(/^\./, '')))]
}

function isAllowedProxyHost(hostname: string) {
  const host = hostname.toLowerCase()
  const exactHosts = configuredAllowedHosts()
  if (exactHosts.includes(host)) return true
  return configuredAllowedSuffixes().some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
}

function proxyError(
  errorCode: ProxyErrorCode,
  status: number,
  message: string,
  details: Record<string, unknown> = {},
  headers?: Headers,
) {
  const outHeaders = new Headers(headers)
  outHeaders.set('Cache-Control', 'no-store')
  return NextResponse.json({
    ok: false,
    success: false,
    errorCode,
    errorMessage: message,
    message,
    ...details,
  }, { status, headers: outHeaders })
}

function fetchErrorCode(error: unknown): ProxyErrorCode {
  if (error instanceof Error && error.name === 'AbortError') return 'proxy_timeout'
  return 'proxy_fetch_failed'
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url') ?? ''
  const proxyRequestUrl = request.nextUrl.toString()
  if (!rawUrl.trim()) {
    return proxyError('proxy_url_missing', 400, 'Missing url parameter.', { proxyUrl: proxyRequestUrl })
  }

  let target: URL
  try {
    target = new URL(rawUrl)
  } catch {
    return proxyError('proxy_url_not_allowed', 403, 'Invalid URL.', { receivedUrl: rawUrl, proxyUrl: proxyRequestUrl })
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return proxyError('proxy_url_not_allowed', 403, 'Only http/https URLs are supported.', {
      receivedUrl: rawUrl,
      hostname: target.hostname,
      proxyRejectedHost: target.hostname,
      proxyUrl: proxyRequestUrl,
    })
  }
  if (isPrivateHost(target.hostname) || !isAllowedProxyHost(target.hostname)) {
    return proxyError('proxy_url_not_allowed', 403, `Proxy target host is not allowed: ${target.hostname}`, {
      receivedUrl: rawUrl,
      hostname: target.hostname,
      proxyRejectedHost: target.hostname,
      proxyUrl: proxyRequestUrl,
    })
  }

  const mediaCandidate = isRenderableMediaUrl(rawUrl)
  if (!mediaCandidate.ok) {
    return proxyError('proxy_url_not_media_candidate', 400, 'Proxy target is not a renderable media URL.', {
      receivedUrl: rawUrl,
      hostname: target.hostname,
      proxyRejectedHost: target.hostname,
      rejectedReason: mediaCandidate.reason,
      providerEndpoint: mediaCandidate.providerEndpoint,
      proxyUrl: proxyRequestUrl,
    })
  }

  const rawToken = getSessionToken()
  const tokenHash = rawToken ? hashToken(rawToken) : ''
  let user: CurrentUser | null
  if (tokenHash) {
    const cached = getCachedProxySession(tokenHash)
    if (cached !== undefined) {
      user = cached
    } else {
      user = await getCurrentUser().catch((error) => {
        console.error('[media-proxy] auth lookup failed', error)
        return null
      })
      setCachedProxySession(tokenHash, user)
    }
  } else {
    user = null
  }
  if (!user) {
    return proxyError('proxy_auth_required', 401, 'Login is required to proxy media URLs.', {
      receivedUrl: rawUrl,
      hostname: target.hostname,
      proxyUrl: proxyRequestUrl,
    })
  }

  const rangeHeader = request.headers.get('range')
  // Video streams send 10-15 parallel Range requests across a high-latency cross-region link
  // (Vercel global → OSS cn-hangzhou). Give them 30 s; keep images at 15 s.
  const isVideoRequest =
    Boolean(rangeHeader) ||
    rawUrl.toLowerCase().includes('.mp4') ||
    rawUrl.toLowerCase().includes('video')
  const timeoutMs = isVideoRequest ? 30_000 : 15_000
  const upstreamHeaders: Record<string, string> = {
    Accept: 'image/*,video/*,audio/*,*/*;q=0.5',
    'User-Agent': 'Mozilla/5.0 (compatible; CreatorCity/1.0)',
  }
  if (rangeHeader) upstreamHeaders['Range'] = rangeHeader

  let upstream: Response
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      upstream = await fetch(target.toString(), {
        method: 'GET',
        headers: upstreamHeaders,
        cache: 'no-store',
        redirect: 'follow',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upstream fetch failed'
    const errorCode = fetchErrorCode(err)
    const status = errorCode === 'proxy_timeout' ? 504 : 502
    console.log('[media-proxy]', {
      receivedUrl: rawUrl,
      proxyRequestUrl,
      hostname: target.hostname,
      errorCode,
      error: msg,
    })
    return proxyError(errorCode, status, msg, {
      receivedUrl: rawUrl,
      hostname: target.hostname,
      proxyUrl: proxyRequestUrl,
    })
  }

  console.log('[media-proxy]', {
    receivedUrl: rawUrl,
    targetUrl: target.toString(),
    urlExactMatch: rawUrl === target.toString(),
    proxyRequestUrl,
    upstreamStatus: upstream.status,
    contentType: upstream.headers.get('content-type'),
    contentLength: upstream.headers.get('content-length'),
  })

  if (!upstream.ok && upstream.status !== 206) {
    const headers = new Headers()
    headers.set('x-media-proxy-upstream-status', String(upstream.status))
    const errorCode: ProxyErrorCode = upstream.status === 403
      ? 'proxy_upstream_403'
      : upstream.status === 404
        ? 'proxy_upstream_404'
        : 'proxy_fetch_failed'
    const status = upstream.status === 403 || upstream.status === 404 ? upstream.status : 502
    return proxyError(errorCode, status, `Upstream returned HTTP ${upstream.status}.`, {
      receivedUrl: rawUrl,
      hostname: target.hostname,
      proxyUrl: proxyRequestUrl,
      upstreamStatus: upstream.status,
    }, headers)
  }

  const contentType = upstream.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
  if (!isAllowedContentType(contentType)) {
    const headers = new Headers()
    headers.set('x-media-proxy-upstream-status', String(upstream.status))
    return proxyError('proxy_fetch_failed', 415, `Non-media content type: ${contentType || 'unknown'}`, {
      receivedUrl: rawUrl,
      hostname: target.hostname,
      proxyUrl: proxyRequestUrl,
      upstreamStatus: upstream.status,
      contentType: contentType || null,
    }, headers)
  }

  const out = new Headers()
  out.set('Content-Type', contentType)
  out.set('Access-Control-Allow-Origin', '*')
  out.set('Cache-Control', isVideoRequest ? 'private, max-age=3600' : 'private, max-age=300')
  out.set('x-media-proxy-upstream-status', String(upstream.status))
  out.set('x-media-proxy-url-exact-match', rawUrl === target.toString() ? 'true' : 'false')
  for (const h of ['content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
    const v = upstream.headers.get(h)
    if (v) out.set(h, v)
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers: out })
}
