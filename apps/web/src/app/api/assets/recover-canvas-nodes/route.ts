// Additive-only recovery: finds Assets that are READY but whose CanvasNode still has a null
// resultImageUrl / resultVideoUrl, and writes the URL from the Asset. Never overwrites existing values.
import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RecoveredItem = {
  nodeId: string
  kind: 'image' | 'video'
  url: string
  assetId: string
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')?.trim()
    if (!projectId) return jsonError('VALIDATION_FAILED', 'projectId is required', 400)

    // Verify project ownership
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    })
    if (!project) return jsonError('NOT_FOUND', '项目不存在。', 404)
    if (project.ownerId !== user.id) return jsonError('FORBIDDEN', '无权访问此项目。', 403)

    // Find READY assets in this project that have a nodeId and workflowId
    const assets = await db.asset.findMany({
      where: {
        projectId,
        status: 'READY',
        url: { not: '' },
        nodeId: { not: null },
        workflowId: { not: null },
        type: { in: ['IMAGE', 'VIDEO'] },
      },
      select: {
        id: true,
        nodeId: true,
        workflowId: true,
        type: true,
        url: true,
      },
    })

    if (assets.length === 0) return jsonOk({ recovered: 0, skipped: 0, items: [] })

    // Batch-fetch all candidate CanvasNodes in one query instead of N serial findUnique calls.
    const assetItems = assets.filter((a) => a.nodeId && a.workflowId && a.url)
    const candidateNodes = await db.canvasNode.findMany({
      where: {
        OR: assetItems.map((a) => ({ workflowId: a.workflowId!, nodeId: a.nodeId! })),
      },
      select: { id: true, workflowId: true, nodeId: true, resultImageUrl: true, resultVideoUrl: true },
    })
    const nodeByKey = new Map(candidateNodes.map((n) => [`${n.workflowId}:${n.nodeId}`, n]))

    const recovered: RecoveredItem[] = []
    let skipped = assets.length - assetItems.length

    for (const asset of assetItems) {
      const kind = asset.type === 'VIDEO' ? 'video' : 'image'
      const node = nodeByKey.get(`${asset.workflowId}:${asset.nodeId}`)

      if (!node) { skipped++; continue }
      if (kind === 'image' && node.resultImageUrl) { skipped++; continue }
      if (kind === 'video' && node.resultVideoUrl) { skipped++; continue }

      // Additive write — only sets if currently null
      await db.canvasNode.update({
        where: { id: node.id },
        data: kind === 'image'
          ? { resultImageUrl: asset.url, status: 'done' }
          : { resultVideoUrl: asset.url, status: 'done' },
      })

      recovered.push({ nodeId: asset.nodeId!, kind, url: asset.url!, assetId: asset.id })
    }

    return jsonOk({ recovered: recovered.length, skipped, items: recovered })
  } catch (error) {
    console.error('[assets/recover-canvas-nodes] failed', error)
    return jsonError('RECOVER_CANVAS_NODES_FAILED', safeErrorMessage(error, '恢复节点素材失败。'), 500)
  }
}
