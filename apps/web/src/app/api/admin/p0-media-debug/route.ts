import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkObjectExists, resolveAssetUrl } from '@/lib/assets/storage-adapter'
import { getNodeImageUrlSources, getNodeVideoUrlSources } from '@/lib/canvas/media-urls'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function recordValue(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
}

function stringValue(v: unknown) {
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

function hasString(v: unknown) {
  return Boolean(stringValue(v))
}

function urlSummary(url: string) {
  if (!url) return null
  let host = ''
  try {
    host = new URL(url).host
  } catch {
    host = url.startsWith('data:') ? 'data-url' : url.startsWith('blob:') ? 'blob-url' : 'relative-or-invalid'
  }
  return {
    exists: true,
    host,
    isBlob: url.startsWith('blob:'),
    isData: url.startsWith('data:'),
    isHttp: /^https?:\/\//i.test(url),
    length: url.length,
  }
}

function metadataKeys(metadata: Record<string, unknown>) {
  return Object.keys(metadata).sort()
}

function assetIdCandidates(node: {
  assetId?: string | null
  metadataJson: unknown
}) {
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  const asset = recordValue(metadata.asset)
  const generationJob = recordValue(metadata.generationJob)
  const generationResult = recordValue(metadata.generationResult)
  const pluginResult = recordValue(metadata.pluginResult)
  const candidates: Array<{ source: string; value: string }> = [
    { source: 'node.assetId', value: stringValue(node.assetId) },
    { source: 'node.metadataJson.assetId', value: stringValue(metadata.assetId) },
    { source: 'node.metadataJson.asset.id', value: stringValue(asset.id) },
    { source: 'node.metadataJson.asset_id', value: stringValue(metadata.asset_id) },
    { source: 'node.metadataJson.mediaAssetId', value: stringValue(metadata.mediaAssetId) },
    { source: 'node.metadataJson.resultAssetId', value: stringValue(metadata.resultAssetId) },
    { source: 'node.metadataJson.outputAssetId', value: stringValue(metadata.outputAssetId) },
    { source: 'node.metadataJson.generationJob.outputAssetId', value: stringValue(generationJob.outputAssetId) },
    { source: 'node.metadataJson.generationResult.outputAssetId', value: stringValue(generationResult.outputAssetId) },
    { source: 'node.metadataJson.pluginResult.outputAssetId', value: stringValue(pluginResult.outputAssetId) },
    { source: 'node.metadataJson.mediaPersistence.assetId', value: stringValue(mediaPersistence.assetId) },
    { source: 'node.metadataJson.mediaPersistence.outputAssetId', value: stringValue(mediaPersistence.outputAssetId) },
  ]
  return candidates.filter((candidate) => candidate.value)
}

function generationJobIdFrom(metadata: Record<string, unknown>, asset?: { generationJobId?: string | null; providerJobId?: string | null } | null) {
  return stringValue(metadata.generationJobId)
    || stringValue(recordValue(metadata.generationJob).id)
    || stringValue(recordValue(metadata.mediaPersistence).generationJobId)
    || stringValue(asset?.generationJobId)
    || stringValue(metadata.taskId)
    || stringValue(asset?.providerJobId)
}

function sourceForNode(node: {
  kind: string
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  metadataJson?: unknown
  preview?: { type?: string; url?: string | null } | null
}) {
  const sources = node.kind === 'image'
    ? getNodeImageUrlSources(node)
    : node.kind === 'video'
      ? getNodeVideoUrlSources(node)
      : []
  return sources[0] ?? { source: '', url: '' }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? request.headers.get('x-p0-debug-token') ?? ''
  const expectedToken = process.env.P0_DEBUG_TOKEN ?? ''
  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? '20'), 50)

  try {
    const nodes = await db.canvasNode.findMany({
      where: { kind: { in: ['image', 'video'] } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        nodeId: true,
        kind: true,
        status: true,
        resultImageUrl: true,
        resultVideoUrl: true,
        metadataJson: true,
        x: true,
        y: true,
        width: true,
        height: true,
        updatedAt: true,
        workflow: {
          select: {
            id: true,
            projectId: true,
          },
        },
      },
    })

    const diagnostics = await Promise.all(nodes.map(async (node) => {
      const metadata = recordValue(node.metadataJson)
      const candidates = assetIdCandidates({ metadataJson: metadata })
      const assetId = candidates[0]?.value ?? ''
      const source = sourceForNode({
        kind: node.kind,
        resultImageUrl: node.resultImageUrl,
        resultVideoUrl: node.resultVideoUrl,
        metadataJson: metadata,
      })

      const asset = assetId
        ? await db.asset.findFirst({
            where: { id: assetId },
            select: {
              id: true,
              status: true,
              storageKey: true,
              storageProvider: true,
              bucket: true,
              url: true,
              originalUrl: true,
              providerJobId: true,
              generationJobId: true,
              recoveryStatus: true,
              error: true,
              metadataJson: true,
            },
          })
        : await db.asset.findFirst({
            where: { nodeId: node.nodeId },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              status: true,
              storageKey: true,
              storageProvider: true,
              bucket: true,
              url: true,
              originalUrl: true,
              providerJobId: true,
              generationJobId: true,
              recoveryStatus: true,
              error: true,
              metadataJson: true,
            },
          })

      let resolvedUrl = ''
      let resolvedSource = ''
      let resolveError = ''
      let objectStatus: Awaited<ReturnType<typeof checkObjectExists>> | null = null
      if (asset) {
        try {
          const resolved = await resolveAssetUrl(asset)
          resolvedUrl = resolved.url
          resolvedSource = resolved.source
        } catch (error) {
          resolveError = error instanceof Error ? error.message : 'resolve failed'
        }
        try {
          objectStatus = await checkObjectExists(asset)
        } catch (error) {
          objectStatus = {
            exists: false,
            status: 0,
            storageProvider: null,
            bucket: asset.bucket,
            storageKey: asset.storageKey,
            message: error instanceof Error ? error.message : 'object check failed',
          }
        }
      }

      const storageKey = stringValue(metadata.storageKey)
        || stringValue(recordValue(metadata.mediaPersistence).storageKey)
        || stringValue(asset?.storageKey)
      const recoveryStatus = stringValue(metadata.recoveryStatus)
        || stringValue(metadata.assetResolveStatus)
        || stringValue(asset?.recoveryStatus)
      const cardSrc = resolvedUrl || source.url
      const resolveBatchStatus = asset
        ? resolvedUrl
          ? 'ready'
          : objectStatus?.status === 403
            ? 'storage_permission_error'
            : objectStatus?.status === 404
              ? 'object_missing'
              : objectStatus?.message
                ? 'missing'
                : 'missing'
        : assetId
          ? 'asset_id_not_found'
          : 'no_asset_id'

      return {
        nodeId: node.nodeId,
        kind: node.kind,
        projectId: node.workflow.projectId,
        workflowId: node.workflow.id,
        position: { x: node.x, y: node.y },
        size: { width: node.width, height: node.height },
        metadataJsonKeys: metadataKeys(metadata),
        assetId: assetId || null,
        assetIdSource: candidates[0]?.source ?? null,
        assetIdCandidates: candidates.map((candidate) => candidate.source),
        generationJobId: generationJobIdFrom(metadata, asset) || null,
        resultImageUrlExists: hasString(node.resultImageUrl),
        resultVideoUrlExists: hasString(node.resultVideoUrl),
        stableUrlExists: hasString(metadata.stableUrl),
        originalUrlExists: hasString(metadata.originalUrl) || hasString(asset?.originalUrl),
        storageKeyExists: Boolean(storageKey),
        assetExists: Boolean(asset),
        assetStatus: asset?.status ?? null,
        assetRecoveryStatus: asset?.recoveryStatus ?? null,
        resolveBatchStatus,
        resolvedUrlExists: Boolean(resolvedUrl),
        resolvedUrlSource: resolvedSource || null,
        canvasNodeCardShouldUse: cardSrc
          ? {
              source: resolvedUrl ? 'resolvedUrl' : source.source,
              url: urlSummary(cardSrc),
            }
          : null,
        recoveryStatus: recoveryStatus || null,
        error: stringValue(metadata.error) || asset?.error || resolveError || objectStatus?.message || null,
        objectExists: objectStatus
          ? {
              exists: objectStatus.exists,
              status: objectStatus.status,
              storageProvider: objectStatus.storageProvider,
              bucket: objectStatus.bucket,
              storageKeyExists: Boolean(objectStatus.storageKey),
              message: objectStatus.message ?? null,
            }
          : null,
        urls: {
          resultImageUrl: urlSummary(node.resultImageUrl ?? ''),
          resultVideoUrl: urlSummary(node.resultVideoUrl ?? ''),
          resolvedUrl: urlSummary(resolvedUrl),
          stableUrl: urlSummary(stringValue(metadata.stableUrl)),
          originalUrl: urlSummary(stringValue(metadata.originalUrl) || stringValue(asset?.originalUrl)),
          currentCandidate: urlSummary(source.url),
        },
        draggable: {
          canvas: 'custom',
          handlerFile: 'apps/web/src/components/create/VisualCanvasWorkspace.tsx',
          nodeCardFile: 'apps/web/src/components/create/CanvasNodeCard.tsx',
          dragStart: 'CanvasNodeCard onPointerDown -> handleNodeDragStart',
          dragMove: 'window pointermove -> handleNodePatch x/y',
          dragStopSave: 'window pointerup -> flushLocalSnapshot + scheduleCanvasSave(0)',
          nodeRootDraggable: true,
          interactiveControlsOptOut: true,
        },
        updatedAt: node.updatedAt.toISOString(),
      }
    }))

    const summary = diagnostics.reduce<Record<string, number>>((acc, item) => {
      acc[item.resolveBatchStatus] = (acc[item.resolveBatchStatus] ?? 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      ok: true,
      count: diagnostics.length,
      summary,
      env: {
        ossConfigured: Boolean(process.env.ALIYUN_ACCESS_KEY_ID && process.env.ALIYUN_ACCESS_KEY_SECRET && process.env.ALIYUN_OSS_BUCKET),
        publicBaseUrlConfigured: Boolean(process.env.ALIYUN_OSS_PUBLIC_BASE_URL),
        p0DebugTokenConfigured: Boolean(expectedToken),
      },
      nodes: diagnostics,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'unknown error' }, { status: 500 })
  }
}
