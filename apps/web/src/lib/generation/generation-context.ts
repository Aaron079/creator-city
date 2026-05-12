import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  attachCurrentUserProjectMemberWithEvidence,
  getProjectAccess,
} from '@/lib/projects/ensure-active-project'

export type GenerationMediaKind = 'image' | 'video'

type PrepareGenerationContextArgs = {
  userId: string
  projectId: string
  workflowId?: string
  nodeId: string
  kind: GenerationMediaKind
  prompt: string
  providerId?: string | null
  model?: string | null
}

export function stringInput(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

export function missingGenerationInput(input: {
  projectId?: unknown
  nodeId?: unknown
  prompt?: unknown
}) {
  const missing: string[] = []
  if (!stringInput(input.projectId)) missing.push('projectId')
  if (!stringInput(input.nodeId)) missing.push('nodeId')
  if (!stringInput(input.prompt)) missing.push('prompt')
  return missing
}

function recordValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

async function ensureWorkflow(projectId: string, workflowId?: string) {
  const explicit = workflowId
    ? await db.canvasWorkflow.findFirst({
        where: { id: workflowId, projectId },
        select: { id: true, projectId: true },
      })
    : null
  if (explicit) return explicit

  const existing = await db.canvasWorkflow.findFirst({
    where: { projectId },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, projectId: true },
  })
  if (existing) return existing

  return db.canvasWorkflow.create({
    data: {
      projectId,
      name: 'Main Canvas',
      viewportJson: { zoom: 1, pan: { x: 0, y: 0 } },
    },
    select: { id: true, projectId: true },
  })
}

export async function prepareGenerationContext(args: PrepareGenerationContextArgs) {
  const project = await db.project.findUnique({
    where: { id: args.projectId },
    select: { id: true, ownerId: true },
  })
  if (!project) {
    return {
      ok: false as const,
      status: 404,
      errorCode: 'project_not_found',
      message: '项目不存在。',
    }
  }

  let access = await getProjectAccess(args.userId, args.projectId)
  if (!access.canWrite) {
    const repair = await attachCurrentUserProjectMemberWithEvidence(
      args.projectId,
      args.userId,
      `${args.kind}_generation_current_project`,
    )
    if (repair.attached) {
      access = await getProjectAccess(args.userId, args.projectId)
    }
  }
  if (!access.canWrite) {
    return {
      ok: false as const,
      status: 403,
      errorCode: 'project_access_denied',
      message: '当前用户无权在该项目生成内容。',
    }
  }

  const workflow = await ensureWorkflow(args.projectId, args.workflowId)
  const existingNode = await db.canvasNode.findUnique({
    where: { workflowId_nodeId: { workflowId: workflow.id, nodeId: args.nodeId } },
    select: { id: true, metadataJson: true, paramsJson: true },
  })
  const metadata = recordValue(existingNode?.metadataJson)
  const params = recordValue(existingNode?.paramsJson)
  const now = new Date()
  const metadataJson = {
    ...metadata,
    projectId: args.projectId,
    workflowId: workflow.id,
    nodeId: args.nodeId,
    providerId: args.providerId ?? metadata.providerId ?? null,
    model: args.model ?? metadata.model ?? null,
    generationRequestedAt: now.toISOString(),
  } satisfies Prisma.InputJsonObject

  await db.canvasNode.upsert({
    where: { workflowId_nodeId: { workflowId: workflow.id, nodeId: args.nodeId } },
    create: {
      workflowId: workflow.id,
      nodeId: args.nodeId,
      kind: args.kind,
      title: args.kind === 'image' ? 'Image' : 'Video',
      providerId: args.providerId ?? args.model ?? null,
      status: 'generating',
      prompt: args.prompt,
      paramsJson: {
        ...params,
        model: args.model ?? args.providerId ?? params.model ?? null,
      },
      metadataJson,
    },
    update: {
      kind: args.kind,
      providerId: args.providerId ?? args.model ?? null,
      status: 'generating',
      prompt: args.prompt,
      paramsJson: {
        ...params,
        model: args.model ?? args.providerId ?? params.model ?? null,
      },
      metadataJson,
      updatedAt: now,
    },
  })

  await db.project.update({
    where: { id: args.projectId },
    data: { lastOpenedAt: now },
    select: { id: true },
  }).catch(() => null)

  return {
    ok: true as const,
    projectId: args.projectId,
    workflowId: workflow.id,
    nodeId: args.nodeId,
    access,
  }
}
