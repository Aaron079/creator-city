import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import {
  PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE,
  isProjectCanvasSchemaMissing,
  projectJsonError,
} from '@/lib/projects/api-errors'
import { mapCanvasEdge, mapCanvasNode } from '@/lib/projects/canvas-mappers'
import { getProjectAccess } from '@/lib/projects/ensure-active-project'

export const dynamic = 'force-dynamic'

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
  stage?: string
  ratio?: string
  outputLabel?: string
  preview?: unknown
}

type CanvasSaveEdge = {
  id?: string
  fromNodeId?: string
  toNodeId?: string
  status?: string
  type?: string
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
  if (!access.canRead || (write && !access.canWrite)) return 'FORBIDDEN' as const
  return project
}

async function ensureWorkflow(projectId: string) {
  const { workflow } = await selectCanvasWorkflow(projectId)
  if (workflow) return workflow

  // Auto-create if project exists but has no workflow yet.
  return db.canvasWorkflow.create({
    data: {
      projectId,
      name: 'Main Canvas',
      viewportJson: { zoom: 1, pan: { x: 0, y: 0 } },
    },
    select: WORKFLOW_SELECT,
  })
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
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  try {
    const project = await requireProjectAccess(params.projectId, user.id)
    if (!project) return projectJsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
    if (project === 'FORBIDDEN') return projectJsonError('FORBIDDEN', '无权访问该项目。', 403)

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

    return NextResponse.json({
      success: true,
      project,
      workflow,
      nodes: nodes.map(mapCanvasNode),
      edges: edges.map(mapCanvasEdge),
      assets: [],
      viewport: workflow.viewportJson,
      serverUpdatedAt: workflow.updatedAt,
      workflowCandidates: selected.workflowCandidates,
    })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return projectJsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[canvas-api] load failed', { projectId: params.projectId, error })
    return NextResponse.json(
      { success: false, errorCode: 'CANVAS_LOAD_FAILED', message: `加载画布失败：${msg}` },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

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
    return projectJsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
  }

  if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
    return projectJsonError('VALIDATION_FAILED', 'nodes and edges are required arrays.', 400)
  }
  const invalidNode = body.nodes.find(
    (node) => typeof node.id !== 'string' || !node.id || typeof node.kind !== 'string' || !node.kind,
  )
  if (invalidNode) {
    return projectJsonError('VALIDATION_FAILED', 'Each node requires id and kind.', 400)
  }

  try {
    const project = await requireProjectAccess(params.projectId, user.id, true)
    if (!project) return projectJsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
    if (project === 'FORBIDDEN') return projectJsonError('FORBIDDEN', '无权访问该项目。', 403)

    const existingWorkflow = body.workflowId
      ? await db.canvasWorkflow.findFirst({ where: { id: body.workflowId, projectId: params.projectId }, select: WORKFLOW_SELECT })
      : null
    const workflow = existingWorkflow ?? await ensureWorkflow(params.projectId)
    if (body.nodes.length === 0 && !body.clearCanvas) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'EMPTY_NODES_IGNORED',
        workflowId: workflow.id,
      })
    }

    const now = new Date()

    // Sequential individual writes — avoids pgBouncer interactive-transaction incompatibility.
    // Atomicity is sacrificed for reliability; the next save will correct any partial state.
    await db.canvasWorkflow.update({
      where: { id: workflow.id },
      data: {
        ...(body.viewport !== undefined ? { viewportJson: body.viewport as Prisma.InputJsonValue } : {}),
        updatedAt: now,
      },
    })

    for (const node of body.nodes ?? []) {
      if (!node.id || !node.kind) continue
      const providerId = node.providerId ?? node.model ?? null
      await db.canvasNode.upsert({
        where: { workflowId_nodeId: { workflowId: workflow.id, nodeId: node.id } },
        create: {
          workflowId: workflow.id,
          nodeId: node.id,
          kind: node.kind,
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
          paramsJson: { model: providerId, stage: node.stage ?? 'draft', ratio: node.ratio ?? null },
          metadataJson: { outputLabel: node.outputLabel ?? null, preview: node.preview ?? null },
        },
        update: {
          kind: node.kind,
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
          paramsJson: { model: providerId, stage: node.stage ?? 'draft', ratio: node.ratio ?? null },
          metadataJson: { outputLabel: node.outputLabel ?? null, preview: node.preview ?? null },
          updatedAt: now,
        },
      })
    }

    for (const edge of body.edges ?? []) {
      if (!edge.id || !edge.fromNodeId || !edge.toNodeId) continue
      await db.canvasEdge.upsert({
        where: { workflowId_edgeId: { workflowId: workflow.id, edgeId: edge.id } },
        create: {
          workflowId: workflow.id,
          edgeId: edge.id,
          sourceNodeId: edge.fromNodeId,
          targetNodeId: edge.toNodeId,
          type: edge.type ?? null,
          metadataJson: { status: edge.status ?? 'active' },
        },
        update: {
          sourceNodeId: edge.fromNodeId,
          targetNodeId: edge.toNodeId,
          type: edge.type ?? null,
          metadataJson: { status: edge.status ?? 'active' },
          updatedAt: now,
        },
      })
    }

    if (body.clearCanvas && (body.nodes ?? []).length === 0) {
      await db.canvasEdge.deleteMany({ where: { workflowId: workflow.id } })
      await db.canvasNode.deleteMany({ where: { workflowId: workflow.id } })
    }

    if (body.deletedNodeIds?.length) {
      await db.canvasNode.deleteMany({
        where: { workflowId: workflow.id, nodeId: { in: body.deletedNodeIds } },
      })
    }
    if (body.deletedEdgeIds?.length) {
      await db.canvasEdge.deleteMany({
        where: { workflowId: workflow.id, edgeId: { in: body.deletedEdgeIds } },
      })
    }

    // Best-effort lastOpenedAt update — never block the save response.
    void db.project.update({
      where: { id: project.id },
      data: { lastOpenedAt: now },
    }).catch((e: unknown) =>
      console.warn('[canvas] failed to touch lastOpenedAt', { projectId: project.id, error: e }),
    )

    return NextResponse.json({
      success: true,
      workflowId: workflow.id,
      savedAt: now.toISOString(),
      nodeCount: body.nodes.length,
      edgeCount: body.edges.length,
    })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return projectJsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[canvas-api] save failed', { projectId: params.projectId, error })
    return NextResponse.json(
      { success: false, errorCode: 'CANVAS_SAVE_FAILED', message: `保存画布失败：${msg}` },
      { status: 500 },
    )
  }
}
