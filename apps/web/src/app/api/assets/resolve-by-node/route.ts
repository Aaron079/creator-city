import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import { resolveAssetById } from '@/lib/assets/asset-resolver'
import { recoveryResponse, terminalRecoveryAction } from '@/lib/assets/recovery-response'
import { db } from '@/lib/db'
import { getProjectAccess } from '@/lib/projects/ensure-active-project'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ResolveByNodeBody = {
  nodeId?: unknown
  projectId?: unknown
  workflowId?: unknown
  legacyUrl?: unknown
  legacyUrls?: unknown
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function assetIdFromMetadata(metadataJson: unknown) {
  const metadata = recordValue(metadataJson)
  const asset = recordValue(metadata.asset)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  const generationJob = recordValue(metadata.generationJob)
  const generationResult = recordValue(metadata.generationResult)
  const pluginResult = recordValue(metadata.pluginResult)
  return [
    metadata.assetId,
    asset.id,
    metadata.asset_id,
    metadata.mediaAssetId,
    metadata.resultAssetId,
    metadata.result_asset_id,
    metadata.media_asset_id,
    metadata.outputAssetId,
    generationJob.outputAssetId,
    generationResult.outputAssetId,
    pluginResult.outputAssetId,
    mediaPersistence.assetId,
    mediaPersistence.outputAssetId,
  ].find((value): value is string => typeof value === 'string' && Boolean(value.trim()))?.trim() ?? ''
}

function generationJobIdFromMetadata(metadataJson: unknown) {
  const metadata = recordValue(metadataJson)
  const generationJob = recordValue(metadata.generationJob)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return [
    metadata.generationJobId,
    metadata.jobId,
    generationJob.id,
    generationJob.jobId,
    mediaPersistence.generationJobId,
  ].find((value): value is string => typeof value === 'string' && Boolean(value.trim()))?.trim() ?? ''
}

function legacyUrlsFrom(value: unknown) {
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [item.trim()]
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const url = stringValue((item as Record<string, unknown>).url)
      return url ? [url] : []
    }
    return []
  })
}

function legacyUrlsFromNode(node: {
  resultImageUrl?: string | null
  resultVideoUrl?: string | null
  resultPreview?: string | null
  metadataJson?: unknown
}) {
  const metadata = recordValue(node.metadataJson)
  const mediaPersistence = recordValue(metadata.mediaPersistence)
  return [
    node.resultImageUrl,
    node.resultVideoUrl,
    node.resultPreview,
    metadata.assetUrl,
    metadata.resolvedUrl,
    metadata.stableUrl,
    metadata.originalUrl,
    metadata.originalProviderUrl,
    metadata.originalProviderImageUrl,
    metadata.originalProviderVideoUrl,
    metadata.providerUrl,
    mediaPersistence.originalUrl,
    mediaPersistence.url,
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
}

function projectAccessWhere(userId: string) {
  return {
    OR: [
      { ownerId: userId },
      { members: { some: { userId, isActive: true, leftAt: null } } },
    ],
  }
}

function resolvedByNodeResponse(resolved: Awaited<ReturnType<typeof resolveAssetById>>) {
  if (!resolved) {
    return recoveryResponse(
      { errorCode: 'no_recovery_source', message: '素材不存在。' },
      { ok: false, action: 'no_recovery_source', recoveryStatus: 'no_recovery_source' },
    )
  }
  const isReady = resolved.status === 'ready' && Boolean(resolved.resolvedUrl)
  return recoveryResponse(resolved, {
    ok: isReady,
    action: isReady ? 'asset_found_by_node' : terminalRecoveryAction(resolved.recoveryStatus || resolved.status),
    recoveryStatus: isReady ? 'ready' : resolved.recoveryStatus || resolved.status,
    errorCode: isReady ? null : resolved.recoveryStatus || resolved.status,
    errorMessage: resolved.error,
  })
}

async function writeResolvedAssetToCanvasNode(args: {
  nodeId: string
  projectId?: string
  workflowId?: string
  userId: string
  resolved: Awaited<ReturnType<typeof resolveAssetById>>
}) {
  const { nodeId, projectId, workflowId, userId, resolved } = args
  if (!resolved?.assetId) return
  const nodes = await db.canvasNode.findMany({
    where: {
      nodeId,
      ...(workflowId ? { workflowId } : {}),
      workflow: {
        ...(projectId ? { projectId } : {}),
        project: projectAccessWhere(userId),
      },
    },
    select: { id: true, kind: true, metadataJson: true },
    take: 10,
  })
  await Promise.all(nodes.map((node) => {
    const metadata = recordValue(node.metadataJson)
    return db.canvasNode.update({
      where: { id: node.id },
      data: {
        ...(resolved.resolvedUrl && node.kind === 'image' ? { resultImageUrl: resolved.resolvedUrl } : {}),
        ...(resolved.resolvedUrl && node.kind === 'video' ? { resultVideoUrl: resolved.resolvedUrl } : {}),
        metadataJson: {
          ...metadata,
          assetId: resolved.assetId,
          ...(resolved.resolvedUrl ? { assetUrl: resolved.resolvedUrl, resolvedUrl: resolved.resolvedUrl, stableUrl: resolved.resolvedUrl } : {}),
          ...(resolved.proxyUrl ? { proxyUrl: resolved.proxyUrl } : {}),
          signedUrlAvailable: resolved.signedUrlAvailable,
          proxyAvailable: resolved.proxyAvailable,
          assetResolveStatus: resolved.status,
          recoveryStatus: resolved.recoveryStatus ?? resolved.status,
          ...(resolved.storageKey ? { storageKey: resolved.storageKey } : {}),
          ...(resolved.storageProvider ? { storageProvider: resolved.storageProvider } : {}),
          ...(resolved.bucket ? { bucket: resolved.bucket } : {}),
          ...(resolved.providerJobId ? { providerJobId: resolved.providerJobId } : {}),
          ...(resolved.status === 'ready' && resolved.resolvedUrl ? { recoveryStatus: 'ready', assetResolveStatus: 'ready', error: null, errorCode: null, errorMessage: null } : {}),
          p0LastResolveResult: resolved,
          p0LastResolveAt: new Date().toISOString(),
        },
      },
    })
  }))
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)
    const userId = user.id

    let body: ResolveByNodeBody
    try {
      body = await request.json() as ResolveByNodeBody
    } catch {
      return jsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
    }

    const nodeId = stringValue(body.nodeId)
    const projectId = stringValue(body.projectId)
    const workflowId = stringValue(body.workflowId)
    if (!nodeId) return jsonError('VALIDATION_FAILED', 'nodeId is required.', 400)

    if (projectId) {
      const access = await getProjectAccess(userId, projectId)
      if (!access.canRead) return jsonError('FORBIDDEN', '无权访问该项目。', 403)
    }

    const canvasNode = await db.canvasNode.findFirst({
      where: {
        nodeId,
        ...(workflowId ? { workflowId } : {}),
        workflow: {
          ...(projectId ? { projectId } : {}),
          project: projectAccessWhere(userId),
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        metadataJson: true,
        resultImageUrl: true,
        resultVideoUrl: true,
        resultPreview: true,
      },
    })

    const resolveAndReturn = async (assetId: string) => {
      const resolved = await resolveAssetById(assetId, userId)
      if (resolved) await writeResolvedAssetToCanvasNode({ nodeId, projectId, workflowId, userId, resolved })
      return jsonOk(resolvedByNodeResponse(resolved), { status: resolved ? 200 : 404 })
    }

    const metadataAssetId = assetIdFromMetadata(canvasNode?.metadataJson)
    if (metadataAssetId) {
      return resolveAndReturn(metadataAssetId)
    }

    const generationJobId = generationJobIdFromMetadata(canvasNode?.metadataJson)
    if (generationJobId) {
      const job = await db.generationJob.findFirst({
        where: {
          id: generationJobId,
          userId: userId,
          ...(projectId ? { projectId } : {}),
          outputAssetId: { not: null },
        },
        select: { outputAssetId: true },
      })
      if (job?.outputAssetId) return resolveAndReturn(job.outputAssetId)
    }

    const candidateJobs = await db.generationJob.findMany({
      where: {
        userId: userId,
        ...(projectId ? { projectId } : {}),
        OR: [
          { nodeId },
          { input: { path: ['nodeId'], equals: nodeId } },
          { output: { path: ['nodeId'], equals: nodeId } },
        ],
        outputAssetId: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { outputAssetId: true, input: true, output: true },
    }).catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      if (!/GenerationJob.*nodeId|nodeId.*GenerationJob|column.*nodeId|Unknown arg `nodeId`/i.test(message)) throw error
      return db.generationJob.findMany({
        where: {
          userId: userId,
          ...(projectId ? { projectId } : {}),
          outputAssetId: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: { outputAssetId: true, input: true, output: true },
      })
    })
    const job = candidateJobs.find((item) => {
      const input = recordValue(item.input)
      const output = recordValue(item.output)
      return stringValue(input.nodeId) === nodeId || stringValue(output.nodeId) === nodeId
    })
    if (job?.outputAssetId) {
      return resolveAndReturn(job.outputAssetId)
    }

    const directAsset = await db.asset.findFirst({
      where: {
        nodeId,
        ...(projectId ? { projectId } : {}),
        ...(workflowId ? { workflowId } : {}),
        OR: [
          { ownerId: userId },
          { project: { ownerId: userId } },
          { project: { members: { some: { userId: userId, isActive: true, leftAt: null } } } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    })

    if (directAsset) {
      return resolveAndReturn(directAsset.id)
    }

    if (projectId) {
      const metadataAsset = await db.asset.findFirst({
        where: {
          projectId,
          OR: [
            { ownerId: userId },
            { project: { ownerId: userId } },
            { project: { members: { some: { userId: userId, isActive: true, leftAt: null } } } },
          ],
          AND: [
            {
              OR: [
                { metadataJson: { path: ['nodeId'], equals: nodeId } },
                { metadataJson: { path: ['canvasNodeId'], equals: nodeId } },
                { metadata: { path: ['nodeId'], equals: nodeId } },
                { metadata: { path: ['canvasNodeId'], equals: nodeId } },
              ],
            },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      if (metadataAsset) return resolveAndReturn(metadataAsset.id)
    }

    const legacyUrls = [...new Set([
      ...legacyUrlsFrom(body.legacyUrl),
      ...legacyUrlsFrom(body.legacyUrls),
      ...legacyUrlsFromNode(canvasNode ?? {}),
    ].filter((url) => /^https?:\/\//i.test(url) || url.startsWith('data:')))].slice(0, 20)
    if (projectId && legacyUrls.length) {
      const urlAsset = await db.asset.findFirst({
        where: {
          projectId,
          OR: [
            { ownerId: userId },
            { project: { ownerId: userId } },
            { project: { members: { some: { userId: userId, isActive: true, leftAt: null } } } },
          ],
          AND: [{
            OR: [
              { url: { in: legacyUrls } },
              { originalUrl: { in: legacyUrls } },
            ],
          }],
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      if (urlAsset) return resolveAndReturn(urlAsset.id)
    }

    return jsonOk({
      ok: false,
      action: 'no_recovery_source',
      assetId: null,
      resolvedUrl: null,
      proxyUrl: null,
      recoveryStatus: 'ASSET_NOT_FOUND_BY_NODE',
      status: 'ASSET_NOT_FOUND_BY_NODE',
      errorCode: 'ASSET_NOT_FOUND_BY_NODE',
      message: '历史 Asset 记录不存在，需要用原 Prompt 重建。',
      nextAction: 'regenerate_from_prompt',
    }, { status: 404 })
  } catch (error) {
    console.error('[assets/resolve-by-node] failed', error)
    return jsonOk(recoveryResponse(
      { errorCode: 'generation_failed', message: safeErrorMessage(error, '按 nodeId 解析素材失败。') },
      { ok: false, action: 'error', recoveryStatus: 'generation_failed' },
    ), { status: 500 })
  }
}
