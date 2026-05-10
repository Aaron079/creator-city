import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import { resolveAssetById } from '@/lib/assets/asset-resolver'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ResolveByNodeBody = {
  nodeId?: unknown
  projectId?: unknown
  workflowId?: unknown
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

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

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

    const directAsset = await db.asset.findFirst({
      where: {
        nodeId,
        ownerId: user.id,
        ...(projectId ? { projectId } : {}),
        ...(workflowId ? { workflowId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    })

    if (directAsset) {
      const resolved = await resolveAssetById(directAsset.id, user.id)
      if (!resolved) return jsonError('ASSET_NOT_FOUND', '素材不存在。', 404)
      return jsonOk(resolved)
    }

    const canvasNode = await db.canvasNode.findFirst({
      where: {
        nodeId,
        ...(workflowId ? { workflowId } : {}),
        workflow: {
          ...(projectId ? { projectId } : {}),
          project: { ownerId: user.id },
        },
      },
      orderBy: { updatedAt: 'desc' },
      select: { metadataJson: true },
    })
    const metadataAssetId = assetIdFromMetadata(canvasNode?.metadataJson)
    if (metadataAssetId) {
      const resolved = await resolveAssetById(metadataAssetId, user.id)
      if (resolved) return jsonOk(resolved)
    }

    const candidateJobs = await db.generationJob.findMany({
      where: {
        userId: user.id,
        ...(projectId ? { projectId } : {}),
        outputAssetId: { not: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { outputAssetId: true, input: true, output: true },
    })
    const job = candidateJobs.find((item) => {
      const input = recordValue(item.input)
      const output = recordValue(item.output)
      return stringValue(input.nodeId) === nodeId || stringValue(output.nodeId) === nodeId
    })
    if (job?.outputAssetId) {
      const resolved = await resolveAssetById(job.outputAssetId, user.id)
      if (resolved) return jsonOk(resolved)
    }

    return jsonError('ASSET_NOT_FOUND_FOR_NODE', '没有从当前 nodeId 找到已存在 Asset。', 404, { nodeId })
  } catch (error) {
    console.error('[assets/resolve-by-node] failed', error)
    return jsonError('ASSET_RESOLVE_BY_NODE_FAILED', safeErrorMessage(error, '按 nodeId 解析素材失败。'), 500)
  }
}
