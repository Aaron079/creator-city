import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_CONTENT_PREFIXES = ['image/', 'video/', 'audio/']

function isAllowedContentType(contentType: string | null) {
  if (!contentType) return false
  const lower = contentType.toLowerCase()
  return ALLOWED_CONTENT_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

function isPrivateHost(hostname: string) {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true
  if (/^10\./.test(h)) return true
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)) return true
  if (/^192\.168\./.test(h)) return true
  if (h.endsWith('.local') || h.endsWith('.internal')) return true
  return false
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url') ?? ''
  if (!rawUrl.trim()) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only http/https URLs are supported' }, { status: 400 })
  }
  if (isPrivateHost(target.hostname)) {
    return NextResponse.json({ error: 'Private addresses are not allowed' }, { status: 403 })
  }

  const rangeHeader = request.headers.get('range')
  const upstreamHeaders: Record<string, string> = {
    Accept: 'image/*,video/*,audio/*,*/*;q=0.5',
    'User-Agent': 'Mozilla/5.0 (compatible; CreatorCity/1.0)',
  }
  if (rangeHeader) upstreamHeaders['Range'] = rangeHeader

  let upstream: Response
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
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
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `Upstream returned ${upstream.status}`, upstreamStatus: upstream.status },
      { status: upstream.status },
    )
  }

  const contentType = upstream.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
  if (!isAllowedContentType(contentType)) {
    return NextResponse.json(
      { error: `Non-media content type: ${contentType || 'unknown'}` },
      { status: 415 },
    )
  }

  const out = new Headers()
  out.set('Content-Type', contentType)
  out.set('Access-Control-Allow-Origin', '*')
  out.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
  for (const h of ['content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
    const v = upstream.headers.get(h)
    if (v) out.set(h, v)
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers: out })
}
