import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { diagnoseMediaUrl } from '@/lib/assets/media-diagnostics'
import { persistGeneratedMedia, type PersistGeneratedMediaInput } from '@/lib/assets/persist-generated-media'

export const dynamic = 'force-dynamic'

type ResyncBody = {
  url?: unknown
  type?: unknown
  projectId?: unknown
  nodeId?: unknown
  filenameHint?: unknown
  metadata?: unknown
}

function jsonError(errorCode: string, message: string, status = 400, details?: Record<string, unknown>) {
  return NextResponse.json({
    success: false,
    errorCode,
    message,
    ...(details ? details : {}),
  }, { status })
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function optionalString(value: unknown) {
  const trimmed = stringValue(value)
  return trimmed || undefined
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return jsonError('UNAUTHORIZED', '请先登录后再同步媒体。', 401)

  let body: ResyncBody
  try {
    body = await request.json() as ResyncBody
  } catch {
    return jsonError('INVALID_JSON', '请求体不是合法 JSON。')
  }

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  if (!url) return jsonError('MEDIA_URL_EMPTY', '当前节点没有可同步的媒体 URL。')

  const type = body.type === 'video' ? 'video' : body.type === 'image' ? 'image' : null
  if (!type) return jsonError('MEDIA_TYPE_INVALID', '媒体类型必须是 image 或 video。')

  const diagnostic = await diagnoseMediaUrl(url)
  if (!diagnostic.reachable) {
    return jsonError('MEDIA_SOURCE_EXPIRED', '源媒体链接已过期，无法重新同步。', 410, { diagnostic })
  }

  const metadata = recordValue(body.metadata)
  const sourceProvider = stringValue(metadata.sourceProvider)
    || stringValue(metadata.providerId)
    || stringValue(metadata.generationSource)
    || 'legacy-provider-url'
  const persistInput: PersistGeneratedMediaInput = {
    url,
    type,
    projectId: optionalString(body.projectId),
    nodeId: optionalString(body.nodeId),
    filenameHint: stringValue(body.filenameHint) || `resynced-${type}.${type === 'image' ? 'png' : 'mp4'}`,
    sourceProvider,
    userId: currentUser.id,
    metadata: {
      ...metadata,
      resyncedFrom: url,
      resyncedAt: new Date().toISOString(),
      mediaResyncDiagnostic: diagnostic,
    },
  }

  const persistence = await persistGeneratedMedia(persistInput)
  if (!persistence.ok) {
    if (persistence.errorCode === 'MEDIA_FETCH_FAILED' && (persistence.upstreamStatus === 403 || persistence.upstreamStatus === 404)) {
      return jsonError('MEDIA_SOURCE_EXPIRED', '源媒体链接已过期，无法重新同步。', 410, { diagnostic })
    }
    return jsonError(persistence.errorCode, persistence.message, 500, { diagnostic })
  }

  return NextResponse.json({
    success: true,
    stableUrl: persistence.stableUrl,
    assetId: persistence.assetId,
    mediaPersistence: persistence,
  }, { status: 200 })
}
