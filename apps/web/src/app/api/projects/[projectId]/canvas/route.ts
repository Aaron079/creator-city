import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { jsonError, jsonOk, safeErrorMessage } from '@/lib/api/json-response'
import {
  PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE,
  isProjectCanvasSchemaMissing,
} from '@/lib/projects/api-errors'
import { mapCanvasEdge, mapCanvasNode } from '@/lib/projects/canvas-mappers'
import {
  attachCurrentUserProjectMemberWithEvidence,
  getProjectAccess,
} from '@/lib/projects/ensure-active-project'

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue
  } catch {
    return {} as Prisma.InputJsonObject
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

interface RouteContext {
  params: { projectId: string }
}

type CanvasSaveNode = {
  id?: string
  kind?: string
  title?: string
  providerId?: string
  model?: string
  status?: string
  x?: number
  y?: number
  width?: number
  height?: number
  prompt?: string
  resultText?: string
  resultImageUrl?: string
  resultVideoUrl?: string
  resultAudioUrl?: string
  resultPreview?: string
  errorMessage?: string
  assetId?: string
  stage?: string
  ratio?: string
  outputLabel?: string
  preview?: unknown
  metadataJson?: unknown
}

type CanvasSaveEdge = {
  id?: string
  fromNodeId?: string
  toNodeId?: string
  status?: string
  type?: string
  metadataJson?: unknown
}

const WORKFLOW_SELECT = {
  id: true,
  projectId: true,
  name: true,
  version: true,
  viewportJson: true,
  metadataJson: true,
  createdAt: true,
  updatedAt: true,
} as const

function mapCanvasNodeWithProject(row: Parameters<typeof mapCanvasNode>[0], projectId: string, workflowId: string) {
  const node = mapCanvasNode(row)
  const metadata = node.metadataJson && typeof node.metadataJson === 'object' && !Array.isArray(node.metadataJson)
    ? node.metadataJson as Record<string, unknown>
    : {}
  return {
    ...node,
    metadataJson: {
      ...metadata,
      projectId,
      workflowId,
      nodeId: node.id,
    },
  }
}

async function requireProjectAccess(projectId: string, userId: string, write = false) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      title: true,
      description: true,
      status: true,
      visibility: true,
      thumbnailUrl: true,
      createdAt: true,
      updatedAt: true,
      lastOpenedAt: true,
    },
  })
  if (!project) return null
  // Owner always has full access — skip potentially-broken ProjectMember lookup.
  if (project.ownerId === userId) return project
  const access = await getProjectAccess(userId, projectId)
  if (!access.canRead || (write && !access.canWrite)) {
    const repair = await attachCurrentUserProjectMemberWithEvidence(
      projectId,
      userId,
      write ? 'canvas_save_current_project' : 'canvas_load_current_project',
    )
    if (!repair.attached) return 'FORBIDDEN' as const
    console.info('[canvas] current project membership repaired', {
      projectId,
      userId,
      reason: repair.reason,
    })
  }
  return project
}

async function ensureWorkflow(projectId: string) {
  const { workflow } = await selectCanvasWorkflow(projectId)
  if (workflow) return workflow

  // Auto-create if project exists but has no workflow yet.
  // Guard against race condition (two concurrent saves → both try to create):
  // if create fails with unique-constraint violation, retry the find.
  try {
    return await db.canvasWorkflow.create({
      data: {
        projectId,
        name: 'Main Canvas',
        viewportJson: { zoom: 1, pan: { x: 0, y: 0 } },
      },
      select: WORKFLOW_SELECT,
    })
  } catch (createErr) {
    const createErrMsg = createErr instanceof Error ? createErr.message : String(createErr)
    // P2002 = unique constraint violation (race: another request created the workflow first)
    if (createErrMsg.includes('P2002') || createErrMsg.includes('Unique constraint')) {
      const { workflow: retried } = await selectCanvasWorkflow(projectId)
      if (retried) return retried
    }
    throw createErr
  }
}

async function selectCanvasWorkflow(projectId: string) {
  const workflows = await db.canvasWorkflow.findMany({
    where: { projectId },
    select: {
      ...WORKFLOW_SELECT,
      _count: { select: { nodes: true } },
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  })

  const selected = [...workflows].sort((left, right) => {
    const leftHasNodes = left._count.nodes > 0 ? 1 : 0
    const rightHasNodes = right._count.nodes > 0 ? 1 : 0
    if (leftHasNodes !== rightHasNodes) return rightHasNodes - leftHasNodes

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })[0]

  if (!selected) {
    return {
      workflow: null,
      workflowCandidates: [],
    }
  }

  const workflow = {
    id: selected.id,
    projectId: selected.projectId,
    name: selected.name,
    version: selected.version,
    viewportJson: selected.viewportJson,
    metadataJson: selected.metadataJson,
    createdAt: selected.createdAt,
    updatedAt: selected.updatedAt,
  }
  return {
    workflow,
    workflowCandidates: workflows.map((candidate) => ({
      id: candidate.id,
      projectId: candidate.projectId,
      name: candidate.name,
      nodeCount: candidate._count.nodes,
      updatedAt: candidate.updatedAt,
      createdAt: candidate.createdAt,
      selected: candidate.id === selected.id,
    })),
  }
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

  try {
    const project = await requireProjectAccess(params.projectId, user.id)
    if (!project) return jsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
    if (project === 'FORBIDDEN') return jsonError('FORBIDDEN', '无权访问该项目。', 403)

    const selected = await selectCanvasWorkflow(params.projectId)
    const workflow = selected.workflow ?? await db.canvasWorkflow.create({
      data: {
        projectId: params.projectId,
        name: 'Main Canvas',
        viewportJson: { zoom: 1, pan: { x: 0, y: 0 } },
      },
      select: WORKFLOW_SELECT,
    })
    const [nodes, edges] = await Promise.all([
      db.canvasNode.findMany({
        where: { workflowId: workflow.id },
        orderBy: [{ createdAt: 'asc' }, { nodeId: 'asc' }],
        select: {
          id: true,
          nodeId: true,
          kind: true,
          title: true,
          providerId: true,
          status: true,
          x: true,
          y: true,
          width: true,
          height: true,
          prompt: true,
          resultText: true,
          resultImageUrl: true,
          resultVideoUrl: true,
          resultAudioUrl: true,
          resultPreview: true,
          errorMessage: true,
          paramsJson: true,
          metadataJson: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.canvasEdge.findMany({
        where: { workflowId: workflow.id },
        orderBy: [{ createdAt: 'asc' }, { edgeId: 'asc' }],
        select: {
          id: true,
          edgeId: true,
          sourceNodeId: true,
          targetNodeId: true,
          type: true,
          metadataJson: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ])

    // Best-effort timestamp update — never block the response.
    void db.project.update({
      where: { id: project.id },
      data: { lastOpenedAt: new Date() },
    }).catch((e: unknown) =>
      console.warn('[canvas] failed to touch lastOpenedAt', { projectId: project.id, error: e }),
    )

    return jsonOk({
      project,
      workflow,
      nodes: nodes.map((node) => mapCanvasNodeWithProject(node, params.projectId, workflow.id)),
      edges: edges.map(mapCanvasEdge),
      assets: [],
      viewport: workflow.viewportJson,
      serverUpdatedAt: workflow.updatedAt,
      workflowCandidates: selected.workflowCandidates,
    })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return jsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    const msg = safeErrorMessage(error)
    console.error('[canvas-api] load failed', { projectId: params.projectId, error })
    return jsonError('CANVAS_LOAD_FAILED', `加载画布失败：${msg}`, 500)
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  // getCurrentUser() now never throws (session.ts wraps DB errors), but keep
  // the catch here as a safety net. Auth failures return 401, not 500.
  let user
  try {
    user = await getCurrentUser()
  } catch (error) {
    console.error('[canvas-api] unexpected auth error before save', { projectId: params.projectId, error })
    return jsonError('UNAUTHORIZED', '认证异常，请刷新页面后重试。', 401)
  }
  if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

  let body: {
    workflowId?: string
    viewport?: unknown
    nodes?: CanvasSaveNode[]
    edges?: CanvasSaveEdge[]
    deletedNodeIds?: string[]
    deletedEdgeIds?: string[]
    clearCanvas?: boolean
  }
  try {
    body = await request.json() as typeof body
  } catch {
    return jsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
  }

  if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
    return jsonError('VALIDATION_FAILED', 'nodes and edges are required arrays.', 400)
  }
  const invalidNode = body.nodes.find(
    (node) => typeof node.id !== 'string' || !node.id || typeof node.kind !== 'string' || !node.kind,
  )
  if (invalidNode) {
    return jsonError('VALIDATION_FAILED', 'Each node requires id and kind.', 400)
  }

  try {
    const project = await requireProjectAccess(params.projectId, user.id, true)
    if (!project) return jsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
    if (project === 'FORBIDDEN') return jsonError('FORBIDDEN', '无权访问该项目。', 403)

    const existingWorkflow = body.workflowId
      ? await db.canvasWorkflow.findFirst({ where: { id: body.workflowId, projectId: params.projectId }, select: WORKFLOW_SELECT })
      : null
    const workflow = existingWorkflow ?? await ensureWorkflow(params.projectId)
    if (body.nodes.length === 0 && !body.clearCanvas) {
      const savedAt = new Date().toISOString()
      const existingNodeCount = await db.canvasNode.count({ where: { workflowId: workflow.id } })
      return jsonOk({
        skipped: true,
        reason: 'EMPTY_NODES_IGNORED',
        workflowId: workflow.id,
        savedAt,
        serverUpdatedAt: workflow.updatedAt instanceof Date ? workflow.updatedAt.toISOString() : savedAt,
        nodeCount: existingNodeCount,
        edgeCount: body.edges.length,
      })
    }

    const now = new Date()

    // Sequential individual writes — avoids pgBouncer interactive-transaction incompatibility.
    // Atomicity is sacrificed for reliability; the next save will correct any partial state.
    try {
      await db.canvasWorkflow.update({
        where: { id: workflow.id },
        data: {
          ...(body.viewport !== undefined ? { viewportJson: body.viewport as Prisma.InputJsonValue } : {}),
          updatedAt: now,
        },
      })
    } catch (workflowErr) {
      console.error('[canvas-api] canvasWorkflow.update failed, continuing with node saves', {
        projectId: params.projectId,
        workflowId: workflow.id,
        error: workflowErr instanceof Error ? workflowErr.message : String(workflowErr),
      })
    }

    // Batched node upserts: BATCH_SIZE nodes run in parallel per batch, batches are serial.
    // Pure parallel over many nodes saturates the single pgBouncer connection (connection_limit=1)
    // and stretches total latency past the 60s Vercel timeout for large canvases.
    const BATCH_SIZE = 5
    const failedNodeIds: string[] = []
    const validNodes = (body.nodes ?? []).filter((node) => node.id && node.kind)
    const nodeResults: PromiseSettledResult<unknown>[] = []
    for (let batchStart = 0; batchStart < validNodes.length; batchStart += BATCH_SIZE) {
      const batchResults = await Promise.allSettled(
        validNodes.slice(batchStart, batchStart + BATCH_SIZE).map((node) => {
        const providerId = node.providerId ?? node.model ?? null
        const nodeMetadata = node.metadataJson && typeof node.metadataJson === 'object'
          ? node.metadataJson as Record<string, unknown>
          : {}
        const metadataJson = sanitizeJson({
          ...nodeMetadata,
          projectId: params.projectId,
          workflowId: workflow.id,
          nodeId: node.id,
          ...(typeof node.assetId === 'string' && node.assetId.trim() ? { assetId: node.assetId.trim() } : {}),
          outputLabel: node.outputLabel ?? nodeMetadata.outputLabel ?? null,
          preview: node.preview ?? nodeMetadata.preview ?? null,
        })
        // Only write resultImageUrl/resultVideoUrl when the frontend has a non-empty value.
        // This prevents a stale null in frontend state from overwriting a valid URL already
        // written to DB by cn-executor (race: poll hasn't returned yet when save fires).
        const mediaResultPatch = {
          ...(typeof node.resultImageUrl === 'string' && node.resultImageUrl.trim().length > 0
            ? { resultImageUrl: node.resultImageUrl }
            : {}),
          ...(typeof node.resultVideoUrl === 'string' && node.resultVideoUrl.trim().length > 0
            ? { resultVideoUrl: node.resultVideoUrl }
            : {}),
        }
        return db.canvasNode.upsert({
          where: { workflowId_nodeId: { workflowId: workflow.id, nodeId: node.id! } },
          create: {
            workflowId: workflow.id,
            nodeId: node.id!,
            kind: node.kind!,
            title: node.title ?? null,
            providerId,
            status: node.status ?? 'idle',
            x: Number(node.x ?? 0),
            y: Number(node.y ?? 0),
            width: Number(node.width ?? 320),
            height: Number(node.height ?? 220),
            prompt: node.prompt ?? null,
            resultText: node.resultText ?? null,
            resultImageUrl: node.resultImageUrl ?? null,
            resultVideoUrl: node.resultVideoUrl ?? null,
            resultAudioUrl: node.resultAudioUrl ?? null,
            resultPreview: node.resultPreview ?? null,
            errorMessage: node.errorMessage ?? null,
            paramsJson: sanitizeJson({ model: providerId, stage: node.stage ?? 'draft', ratio: node.ratio ?? null }),
            metadataJson,
          },
          update: {
            kind: node.kind!,
            title: node.title ?? null,
            providerId,
            status: node.status ?? 'idle',
            x: Number(node.x ?? 0),
            y: Number(node.y ?? 0),
            width: Number(node.width ?? 320),
            height: Number(node.height ?? 220),
            prompt: node.prompt ?? null,
            resultText: node.resultText ?? null,
            ...mediaResultPatch,
            resultAudioUrl: node.resultAudioUrl ?? null,
            resultPreview: node.resultPreview ?? null,
            errorMessage: node.errorMessage ?? null,
            paramsJson: sanitizeJson({ model: providerId, stage: node.stage ?? 'draft', ratio: node.ratio ?? null }),
            metadataJson,
            updatedAt: now,
          },
        })
      }),
      )
      nodeResults.push(...batchResults)
    }
    nodeResults.forEach((result, i) => {
      if (result.status === 'rejected') {
        const nodeId = validNodes[i]?.id ?? '?'
        failedNodeIds.push(nodeId)
        console.error('[canvas-api] node upsert failed, continuing', {
          projectId: params.projectId,
          workflowId: workflow.id,
          nodeId,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        })
      }
    })

    // Parallel edge upserts for the same reason.
    const failedEdgeIds: string[] = []
    const validEdges = (body.edges ?? []).filter((edge) => edge.id && edge.fromNodeId && edge.toNodeId)
    const edgeResults = await Promise.allSettled(
      validEdges.map((edge) => {
        const edgeMetadata = edge.metadataJson && typeof edge.metadataJson === 'object'
          ? edge.metadataJson as Record<string, unknown>
          : {}
        const metadataJson = sanitizeJson({ ...edgeMetadata, status: edge.status ?? edgeMetadata.status ?? 'active' })
        return db.canvasEdge.upsert({
          where: { workflowId_edgeId: { workflowId: workflow.id, edgeId: edge.id! } },
          create: {
            workflowId: workflow.id,
            edgeId: edge.id!,
            sourceNodeId: edge.fromNodeId!,
            targetNodeId: edge.toNodeId!,
            type: edge.type ?? 'flow',
            metadataJson,
          },
          update: {
            sourceNodeId: edge.fromNodeId!,
            targetNodeId: edge.toNodeId!,
            type: edge.type ?? 'flow',
            metadataJson,
            updatedAt: now,
          },
        })
      }),
    )
    edgeResults.forEach((result, i) => {
      if (result.status === 'rejected') {
        const edgeId = validEdges[i]?.id ?? '?'
        failedEdgeIds.push(edgeId)
        console.error('[canvas-api] edge upsert failed, continuing', {
          projectId: params.projectId,
          workflowId: workflow.id,
          edgeId,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        })
      }
    })

    if (body.clearCanvas && (body.nodes ?? []).length === 0) {
      await Promise.allSettled([
        db.canvasEdge.deleteMany({ where: { workflowId: workflow.id } }),
        db.canvasNode.deleteMany({ where: { workflowId: workflow.id } }),
      ])
    }

    if (body.deletedNodeIds?.length) {
      await db.canvasNode.deleteMany({
        where: { workflowId: workflow.id, nodeId: { in: body.deletedNodeIds } },
      }).catch((e: unknown) => console.warn('[canvas-api] deletedNodes failed', e))
    }
    if (body.deletedEdgeIds?.length) {
      await db.canvasEdge.deleteMany({
        where: { workflowId: workflow.id, edgeId: { in: body.deletedEdgeIds } },
      }).catch((e: unknown) => console.warn('[canvas-api] deletedEdges failed', e))
    }

    // Best-effort lastOpenedAt update — never block the save response.
    void db.project.update({
      where: { id: project.id },
      data: { lastOpenedAt: now },
    }).catch((e: unknown) =>
      console.warn('[canvas] failed to touch lastOpenedAt', { projectId: project.id, error: e }),
    )

    const hasPartialFailure = failedNodeIds.length > 0 || failedEdgeIds.length > 0
    if (hasPartialFailure) {
      console.warn('[canvas-api] partial save', {
        projectId: params.projectId,
        workflowId: workflow.id,
        failedNodeIds,
        failedEdgeIds,
      })
    }
    return jsonOk({
      workflowId: workflow.id,
      savedAt: now.toISOString(),
      serverUpdatedAt: now.toISOString(),
      nodeCount: body.nodes.length,
      edgeCount: body.edges.length,
      ...(hasPartialFailure ? { failedNodeIds, failedEdgeIds, partialSave: true } : {}),
    })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return jsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    const msg = safeErrorMessage(error)
    const prismaCode = (error as { code?: string }).code ?? ''
    console.error('[canvas-api] save failed', { projectId: params.projectId, prismaCode, error: msg })
    // Classify common Prisma error codes into informative responses
    if (prismaCode === 'P2025') {
      return jsonError('CANVAS_DB_ERROR', `保存失败：目标记录不存在（可能已被删除）：${msg}`, 409)
    }
    if (prismaCode === 'P2002') {
      return jsonError('CANVAS_DB_ERROR', `保存失败：并发写入冲突，请稍后重试：${msg}`, 409)
    }
    if (prismaCode === 'P2024' || msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')) {
      return jsonError('CANVAS_DB_TIMEOUT', `保存超时：数据库响应超时，请稍后重试：${msg}`, 503)
    }
    if (prismaCode.startsWith('P1')) {
      return jsonError('CANVAS_DB_CONNECTION', `数据库连接失败，请稍后重试：${msg}`, 503)
    }
    return jsonError('CANVAS_SAVE_FAILED', `保存画布失败：${msg}`, 500)
  }
}
