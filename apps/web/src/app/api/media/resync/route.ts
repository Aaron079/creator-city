import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { diagnoseMediaUrl } from '@/lib/assets/media-diagnostics'
import { persistGeneratedMedia, type PersistGeneratedMediaInput } from '@/lib/assets/persist-generated-media'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type ResyncBody = {
  url?: unknown
  type?: unknown
  projectId?: unknown
  workflowId?: unknown
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

async function writeAssetIdToCanvasNode(args: {
  nodeId: string
  assetId: string
  userId: string
  projectId?: string
  workflowId?: string
  patch: Record<string, unknown>
}) {
  const { nodeId, assetId, userId, projectId, workflowId, patch } = args
  if (!nodeId || !assetId) return
  const nodes = await db.canvasNode.findMany({
    where: {
      nodeId,
      ...(workflowId ? { workflowId } : {}),
      workflow: {
        ...(projectId ? { projectId } : {}),
        project: { ownerId: userId },
      },
    },
    select: { id: true, metadataJson: true },
    take: 10,
  })
  await Promise.all(nodes.map((node) => {
    const metadata = recordValue(node.metadataJson)
    return db.canvasNode.update({
      where: { id: node.id },
      data: {
          metadataJson: {
            ...metadata,
            assetId,
            ...patch,
          },
        },
      })
    }))
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

  // If nodeId provided, check if an Asset already exists for this node in the DB.
  // This handles legacy nodes that have a nodeId->Asset link but lost assetId from metadataJson.
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId.trim() : ''
  const metadata = recordValue(body.metadata)
  const metadataAssetId = stringValue(metadata.assetId)
  if (nodeId && !metadataAssetId) {
    try {
      const { resolveAssetById } = await import('@/lib/assets/asset-resolver')
      const existingAsset = await db.asset.findFirst({
        where: {
          nodeId,
          ownerId: currentUser.id,
          ...(optionalString(body.projectId) ? { projectId: optionalString(body.projectId) } : {}),
          ...(optionalString(body.workflowId) ? { workflowId: optionalString(body.workflowId) } : {}),
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
      if (existingAsset) {
        const resolved = await resolveAssetById(existingAsset.id, currentUser.id)
        if (resolved && resolved.status === 'ready' && resolved.resolvedUrl) {
          await writeAssetIdToCanvasNode({
            nodeId,
            assetId: resolved.assetId,
            userId: currentUser.id,
            projectId: optionalString(body.projectId),
            workflowId: optionalString(body.workflowId),
            patch: {
            assetUrl: resolved.resolvedUrl,
            resolvedUrl: resolved.resolvedUrl,
            storageKey: resolved.storageKey,
            storageProvider: resolved.storageProvider,
            bucket: resolved.bucket,
            recoveryStatus: resolved.recoveryStatus ?? 'resolved_by_node_id',
            assetResolveStatus: 'ready',
            },
          })
          return NextResponse.json({
            success: true,
            stableUrl: resolved.resolvedUrl,
            assetId: resolved.assetId,
            mediaPersistence: {
              status: 'persisted',
              assetId: resolved.assetId,
              storageKey: resolved.storageKey,
              storageProvider: resolved.storageProvider,
              recoveredAt: new Date().toISOString(),
            },
          }, { status: 200 })
        }
      }
    } catch {
      // Fall through to URL download
    }
  }

  if (!url) return jsonError('MEDIA_URL_EMPTY', '当前节点没有可同步的媒体 URL。')

  const type = body.type === 'video' ? 'video' : body.type === 'image' ? 'image' : null
  if (!type) return jsonError('MEDIA_TYPE_INVALID', '媒体类型必须是 image 或 video。')

  const diagnostic = await diagnoseMediaUrl(url)
  if (!diagnostic.reachable) {
    return jsonError('MEDIA_SOURCE_EXPIRED', '源媒体链接已过期，无法重新同步。', 410, { diagnostic })
  }

  const sourceProvider = stringValue(metadata.sourceProvider)
    || stringValue(metadata.providerId)
    || stringValue(metadata.generationSource)
    || 'legacy-provider-url'
  const persistInput: PersistGeneratedMediaInput = {
    url,
    type,
    projectId: optionalString(body.projectId),
    workflowId: optionalString(body.workflowId),
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

  if (persistence.assetId) {
    await writeAssetIdToCanvasNode({
      nodeId: optionalString(body.nodeId) ?? '',
      assetId: persistence.assetId,
      userId: currentUser.id,
      projectId: optionalString(body.projectId),
      workflowId: optionalString(body.workflowId),
      patch: {
      assetUrl: persistence.stableUrl,
      resolvedUrl: persistence.stableUrl,
      storageKey: persistence.storageKey,
      storageProvider: persistence.storageProvider,
      bucket: persistence.bucket,
      recoveryStatus: 'recovered_from_old_url',
      assetResolveStatus: 'ready',
      mediaPersistence: persistence,
      },
    })
  }

  return NextResponse.json({
    success: true,
    stableUrl: persistence.stableUrl,
    assetId: persistence.assetId,
    mediaPersistence: persistence,
  }, { status: 200 })
}
