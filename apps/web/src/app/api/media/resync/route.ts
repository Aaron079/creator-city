import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { diagnoseMediaUrl } from '@/lib/assets/media-diagnostics'
import { persistGeneratedMedia, type PersistGeneratedMediaInput } from '@/lib/assets/persist-generated-media'
import { recoveryResponse, terminalRecoveryAction } from '@/lib/assets/recovery-response'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

type ResyncBody = {
  url?: unknown
  urls?: unknown
  type?: unknown
  projectId?: unknown
  workflowId?: unknown
  nodeId?: unknown
  filenameHint?: unknown
  metadata?: unknown
}

function jsonError(errorCode: string, message: string, status = 400, details?: Record<string, unknown>) {
  return NextResponse.json(recoveryResponse({
    errorCode,
    message,
    ...(details ? details : {}),
  }, {
    ok: false,
    action: terminalRecoveryAction(errorCode),
    recoveryStatus: errorCode,
    errorCode,
    errorMessage: message,
    attemptedUrls: details?.attemptedUrls,
    failedUrls: details?.failedUrls ?? details?.attemptedUrls,
  }), { status })
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

function normalizeUrlCandidates(body: ResyncBody) {
  const rawCandidates = Array.isArray(body.urls) ? body.urls : []
  const candidates = rawCandidates.flatMap((item): Array<{ url: string; source: string }> => {
    if (typeof item === 'string') return [{ url: item.trim(), source: 'request.urls' }]
    const record = recordValue(item)
    const url = stringValue(record.url)
    if (!url) return []
    return [{ url, source: stringValue(record.source) || 'request.urls' }]
  })
  const singleUrl = typeof body.url === 'string' ? body.url.trim() : ''
  if (singleUrl) candidates.unshift({ url: singleUrl, source: 'request.url' })
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    if (!candidate.url || seen.has(candidate.url)) return false
    seen.add(candidate.url)
    return true
  })
}

function candidateLooksProviderOwned(candidate: { url: string; source: string }) {
  return /provider|seedance|seedream|jimeng|volc|runway|luma|pika|kling/i.test(`${candidate.source} ${candidate.url}`)
}

function attemptedProviderDownloadFailed(attemptedUrls: Array<Record<string, unknown>>) {
  return attemptedUrls.some((attempt) => {
    const errorCode = stringValue(attempt.errorCode)
    const message = stringValue(attempt.message)
    const diagnostic = recordValue(attempt.diagnostic)
    const diagnosticMessage = stringValue(diagnostic.message)
    const haystack = `${errorCode} ${message} ${diagnosticMessage}`.toLowerCase()
    return errorCode === 'PROVIDER_MEDIA_DOWNLOAD_FAILED'
      || errorCode === 'MEDIA_FETCH_FAILED'
      || errorCode === 'ASSET_DOWNLOAD_FAILED'
      || errorCode === 'ASSET_DOWNLOAD_ERROR'
      || /media download failed|failed to download|download failed|external asset/.test(haystack)
  })
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

  const urlCandidates = normalizeUrlCandidates(body)

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
            recoveryStatus: 'ready',
            assetResolveStatus: 'ready',
            },
          })
          return NextResponse.json({
            ...recoveryResponse({
              ...resolved,
              stableUrl: resolved.resolvedUrl,
              resolvedUrl: resolved.resolvedUrl,
              mediaPersistence: {
              status: 'persisted',
              assetId: resolved.assetId,
              storageKey: resolved.storageKey,
              storageProvider: resolved.storageProvider,
              recoveredAt: new Date().toISOString(),
            },
            }, {
              ok: true,
              action: 'asset_found_by_node',
              recoveryStatus: 'ready',
            }),
          }, { status: 200 })
        }
      }
    } catch {
      // Fall through to URL download
    }
  }

  if (!urlCandidates.length) return jsonError('no_recovery_source', '当前节点没有可同步的媒体 URL。')

  const type = body.type === 'video' ? 'video' : body.type === 'image' ? 'image' : null
  if (!type) return jsonError('MEDIA_TYPE_INVALID', '媒体类型必须是 image 或 video。')

  const sourceProvider = stringValue(metadata.sourceProvider)
    || stringValue(metadata.providerId)
    || stringValue(metadata.generationSource)
    || 'legacy-provider-url'
  const attemptedUrls: Array<Record<string, unknown>> = []

  for (const candidate of urlCandidates) {
    const diagnostic = candidate.url.startsWith('data:')
      ? {
          reachable: true,
          status: 200,
          upstreamStatus: 200,
          corsBlocked: false,
          expiredLikely: false,
          message: 'Data URL 可直接转存。',
        }
      : await diagnoseMediaUrl(candidate.url)
    if (!diagnostic.reachable) {
      attemptedUrls.push({ ...candidate, ok: false, errorCode: 'MEDIA_SOURCE_EXPIRED', diagnostic })
      continue
    }

    const persistInput: PersistGeneratedMediaInput = {
      url: candidate.url,
      type,
      projectId: optionalString(body.projectId),
      workflowId: optionalString(body.workflowId),
      nodeId: optionalString(body.nodeId),
      filenameHint: stringValue(body.filenameHint) || `resynced-${type}.${type === 'image' ? 'png' : 'mp4'}`,
      sourceProvider,
      userId: currentUser.id,
      metadata: {
        ...metadata,
        resyncedFrom: candidate.url,
        resyncedFromSource: candidate.source,
        resyncedAt: new Date().toISOString(),
        mediaResyncDiagnostic: diagnostic,
      },
    }

    const persistence = await persistGeneratedMedia(persistInput)
    if (!persistence.ok) {
      attemptedUrls.push({
        ...candidate,
        ok: false,
        errorCode: persistence.errorCode,
        message: persistence.message,
        upstreamStatus: persistence.upstreamStatus,
        diagnostic,
      })
      continue
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
        recoveryStatus: 'ready',
        assetResolveStatus: 'ready',
        mediaPersistence: persistence,
        attemptedUrls: [...attemptedUrls, { ...candidate, ok: true, diagnostic }],
        },
      })
    }

    return NextResponse.json(recoveryResponse({
      assetId: persistence.assetId,
      resolvedUrl: persistence.stableUrl,
      assetUrl: persistence.stableUrl,
      stableUrl: persistence.stableUrl,
      storageKey: persistence.storageKey,
      storageProvider: persistence.storageProvider,
      bucket: persistence.bucket,
      mediaPersistence: persistence,
      attemptedUrls: [...attemptedUrls, { ...candidate, ok: true, diagnostic }],
    }, {
      ok: true,
      action: 'resynced_from_old_url',
      recoveryStatus: 'ready',
      attemptedUrls: [...attemptedUrls, { ...candidate, ok: true, diagnostic }],
    }), { status: 200 })
  }

  const providerOwned = urlCandidates.some(candidateLooksProviderOwned) || attemptedProviderDownloadFailed(attemptedUrls)
  const errorCode = providerOwned ? 'provider_media_download_failed' : 'old_url_expired'
  return jsonError(
    errorCode,
    providerOwned
      ? 'Provider URL 或参考媒体 URL 已不可下载，无法重新同步。'
      : '旧媒体 URL 候选已全部过期或不可下载，无法重新同步。',
    410,
    { attemptedUrls, failedUrls: attemptedUrls },
  )
}
