import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { isProjectCanvasSchemaMissing } from '@/lib/projects/api-errors'
import { getProjectAccess } from '@/lib/projects/ensure-active-project'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: { projectId: string }
}

const COMMENT_SELECT = {
  id: true,
  projectId: true,
  workflowId: true,
  nodeId: true,
  authorId: true,
  body: true,
  status: true,
  x: true,
  y: true,
  metadataJson: true,
  createdAt: true,
  updatedAt: true,
} as const

function jsonError(errorCode: string, message: string, status: number, details?: string) {
  return NextResponse.json({
    success: false,
    errorCode,
    message,
    ...(details ? { details } : {}),
  }, { status })
}

async function requireProjectAccess(projectId: string, userId: string, write = false) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true },
  })
  if (!project) return null
  if (project.ownerId === userId) return project
  const access = await getProjectAccess(userId, projectId)
  if (!access.canRead || (write && !access.canWrite)) return 'FORBIDDEN' as const
  return project
}

async function ensureWorkflow(projectId: string, workflowId?: string) {
  if (workflowId) {
    const existing = await db.canvasWorkflow.findFirst({
      where: { id: workflowId, projectId },
      select: { id: true, projectId: true },
    })
    if (existing) return existing
  }

  const existing = await db.canvasWorkflow.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
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

function mapComment(comment: Prisma.CanvasCommentGetPayload<{ select: typeof COMMENT_SELECT }>) {
  return {
    ...comment,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  }
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

  try {
    const project = await requireProjectAccess(params.projectId, user.id)
    if (!project) return jsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
    if (project === 'FORBIDDEN') return jsonError('FORBIDDEN', '无权访问该项目。', 403)

    const workflowId = request.nextUrl.searchParams.get('workflowId') ?? undefined
    const workflow = await ensureWorkflow(params.projectId, workflowId)
    const comments = await db.canvasComment.findMany({
      where: {
        projectId: params.projectId,
        workflowId: workflow.id,
      },
      orderBy: { createdAt: 'desc' },
      select: COMMENT_SELECT,
    })

    return NextResponse.json({
      success: true,
      projectId: params.projectId,
      workflowId: workflow.id,
      comments: comments.map(mapComment),
    })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return jsonError('DB_SCHEMA_MISSING', 'CanvasComment 表未同步，请执行 canvas-comments-setup.sql。', 503)
    }
    const message = error instanceof Error ? error.message : String(error)
    console.error('[canvas-comments-api] list failed', { projectId: params.projectId, error })
    return jsonError('COMMENTS_LOAD_FAILED', '加载画布评论失败。', 500, message)
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

  let body: {
    workflowId?: string
    nodeId?: string | null
    body?: string
    x?: number | null
    y?: number | null
    metadata?: unknown
  }
  try {
    body = await request.json() as typeof body
  } catch {
    return jsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
  }

  const text = body.body?.trim()
  if (!text) return jsonError('VALIDATION_FAILED', '评论内容不能为空。', 400)
  if (text.length > 2000) return jsonError('VALIDATION_FAILED', '评论内容不能超过 2000 字。', 400)

  try {
    const project = await requireProjectAccess(params.projectId, user.id, true)
    if (!project) return jsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
    if (project === 'FORBIDDEN') return jsonError('FORBIDDEN', '无权评论该项目。', 403)

    const workflow = await ensureWorkflow(params.projectId, body.workflowId)
    const comment = await db.canvasComment.create({
      data: {
        projectId: params.projectId,
        workflowId: workflow.id,
        nodeId: body.nodeId || null,
        authorId: user.id,
        body: text,
        status: 'open',
        x: typeof body.x === 'number' ? body.x : null,
        y: typeof body.y === 'number' ? body.y : null,
        metadataJson: body.metadata === undefined || body.metadata === null
          ? Prisma.JsonNull
          : body.metadata as Prisma.InputJsonValue,
      },
      select: COMMENT_SELECT,
    })

    return NextResponse.json({
      success: true,
      comment: mapComment(comment),
    }, { status: 201 })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return jsonError('DB_SCHEMA_MISSING', 'CanvasComment 表未同步，请执行 canvas-comments-setup.sql。', 503)
    }
    const message = error instanceof Error ? error.message : String(error)
    console.error('[canvas-comments-api] create failed', { projectId: params.projectId, error })
    return jsonError('COMMENT_CREATE_FAILED', '保存画布评论失败。', 500, message)
  }
}
