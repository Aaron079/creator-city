import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import {
  PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE,
  isProjectCanvasSchemaMissing,
  projectJsonError,
} from '@/lib/projects/api-errors'
import { mapCanvasEdge, mapCanvasNode, serializeAsset } from '@/lib/projects/canvas-mappers'

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

async function requireOwnedProject(projectId: string, userId: string) {
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
  if (project.ownerId !== userId) return 'FORBIDDEN' as const
  return project
}

async function ensureWorkflow(projectId: string) {
  const workflow = await db.canvasWorkflow.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  })
  if (workflow) return workflow
  return db.canvasWorkflow.create({
    data: {
      projectId,
      name: 'Main Canvas',
      viewportJson: { zoom: 1, pan: { x: 0, y: 0 } },
    },
  })
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  try {
    const project = await requireOwnedProject(params.projectId, user.id)
    if (!project) return projectJsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
    if (project === 'FORBIDDEN') return projectJsonError('FORBIDDEN', '无权访问该项目。', 403)

    const workflow = await ensureWorkflow(params.projectId)
    const [nodes, edges, assets] = await Promise.all([
      db.canvasNode.findMany({ where: { workflowId: workflow.id }, orderBy: { createdAt: 'asc' } }),
      db.canvasEdge.findMany({ where: { workflowId: workflow.id }, orderBy: { createdAt: 'asc' } }),
      db.asset.findMany({
        where: { ownerId: user.id, OR: [{ projectId: project.id }, { workflowId: workflow.id }] },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ])

    await db.project.update({
      where: { id: project.id },
      data: { lastOpenedAt: new Date() },
    })

    return NextResponse.json({
      project,
      workflow,
      nodes: nodes.map(mapCanvasNode),
      edges: edges.map(mapCanvasEdge),
      assets: assets.map(serializeAsset),
    })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return projectJsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    console.error('[projects] failed to load canvas', error)
    return NextResponse.json({ message: '加载画布失败。' }, { status: 500 })
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
  }
  try {
    body = await request.json() as typeof body
  } catch {
    return projectJsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
  }

  if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
    return projectJsonError('VALIDATION_FAILED', 'nodes and edges are required arrays.', 400)
  }

  try {
    const project = await requireOwnedProject(params.projectId, user.id)
    if (!project) return projectJsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
    if (project === 'FORBIDDEN') return projectJsonError('FORBIDDEN', '无权访问该项目。', 403)

    const existingWorkflow = body.workflowId
      ? await db.canvasWorkflow.findFirst({ where: { id: body.workflowId, projectId: params.projectId } })
      : null
    const workflow = existingWorkflow ?? await ensureWorkflow(params.projectId)
    const now = new Date()

    await db.$transaction(async (tx) => {
      await tx.canvasWorkflow.update({
        where: { id: workflow.id },
        data: {
          ...(body.viewport !== undefined ? { viewportJson: body.viewport as Prisma.InputJsonValue } : {}),
          updatedAt: now,
        },
      })

      for (const node of body.nodes ?? []) {
        if (!node.id || !node.kind) continue
        const providerId = node.providerId ?? node.model ?? null
        await tx.canvasNode.upsert({
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
        await tx.canvasEdge.upsert({
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

      if (body.deletedNodeIds?.length) {
        await tx.canvasNode.deleteMany({
          where: { workflowId: workflow.id, nodeId: { in: body.deletedNodeIds } },
        })
      }
      if (body.deletedEdgeIds?.length) {
        await tx.canvasEdge.deleteMany({
          where: { workflowId: workflow.id, edgeId: { in: body.deletedEdgeIds } },
        })
      }

      await tx.project.update({
        where: { id: project.id },
        data: { lastOpenedAt: now },
      })
    })

    return NextResponse.json({ ok: true, workflowId: workflow.id, savedAt: now.toISOString() })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return projectJsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    console.error('[projects] failed to save canvas', error)
    return NextResponse.json({ message: '保存画布失败。' }, { status: 500 })
  }
}
