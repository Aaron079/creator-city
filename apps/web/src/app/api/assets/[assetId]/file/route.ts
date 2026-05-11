import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { readStoredAssetObject } from '@/lib/assets/storage-adapter'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = {
  params: { assetId: string }
}

const ALLOWED_CONTENT_PREFIXES = ['image/', 'video/', 'audio/']

function isAllowedContentType(contentType: string) {
  const lower = contentType.toLowerCase()
  return ALLOWED_CONTENT_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

function parseRange(value: string | null, size: number) {
  if (!value) return null
  const match = value.match(/^bytes=(\d*)-(\d*)$/)
  if (!match) return null
  const startText = match[1] ?? ''
  const endText = match[2] ?? ''
  if (!startText && !endText) return null
  if (!startText) {
    const suffix = Number(endText)
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }
  const start = Number(startText)
  const end = endText ? Number(endText) : size - 1
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) return null
  return { start, end: Math.min(end, size - 1) }
}

function jsonStorageError(result: Extract<Awaited<ReturnType<typeof readStoredAssetObject>>, { ok: false }>) {
  const status = result.errorCode === 'object_missing'
    ? 404
    : result.errorCode === 'storage_permission_error'
      ? 403
      : result.errorCode === 'signing_error'
        ? 502
        : 502
  return NextResponse.json({
    ok: false,
    errorCode: result.errorCode,
    message: result.message,
    storageProvider: result.storageProvider ?? null,
    bucket: result.bucket ?? null,
    storageKey: result.storageKey ?? null,
  }, { status })
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const assetId = params.assetId?.trim()
  if (!assetId) {
    return NextResponse.json({ ok: false, errorCode: 'object_missing', message: 'assetId is required.' }, { status: 400 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, errorCode: 'storage_permission_error', message: '请先登录。' }, { status: 401 })
  }

  const asset = await db.asset.findFirst({
    where: { id: assetId, ownerId: user.id },
  })
  if (!asset) {
    return NextResponse.json({ ok: false, errorCode: 'object_missing', message: '素材不存在或不属于当前用户。' }, { status: 404 })
  }

  const result = await readStoredAssetObject(asset)
  if (!result.ok) return jsonStorageError(result)

  const contentType = result.mimeType && result.mimeType !== 'application/octet-stream'
    ? result.mimeType
    : asset.mimeType || 'application/octet-stream'
  if (!isAllowedContentType(contentType)) {
    return NextResponse.json({
      ok: false,
      errorCode: 'proxy_error',
      message: `Unsupported asset content type: ${contentType}`,
    }, { status: 415 })
  }

  const headers = new Headers()
  headers.set('Content-Type', contentType)
  headers.set('Content-Length', String(result.size))
  headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=60')
  headers.set('Accept-Ranges', 'bytes')
  headers.set('x-asset-file-proxy', 'true')
  headers.set('x-asset-storage-provider', result.storageProvider)
  if (result.bucket) headers.set('x-asset-bucket', result.bucket)

  const range = parseRange(request.headers.get('range'), result.buffer.byteLength)
  if (range) {
    const chunk = result.buffer.subarray(range.start, range.end + 1)
    headers.set('Content-Length', String(chunk.byteLength))
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${result.buffer.byteLength}`)
    return new NextResponse(new Uint8Array(chunk), { status: 206, headers })
  }

  return new NextResponse(new Uint8Array(result.buffer), { status: 200, headers })
}
