import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { isProjectCanvasSchemaMissing } from '@/lib/projects/api-errors'
import { getProjectAccess } from '@/lib/projects/ensure-active-project'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: { projectId: string; commentId: string }
}

function jsonError(errorCode: string, message: string, status: number, details?: string) {
  return NextResponse.json({
    success: false,
    errorCode,
    message,
    ...(details ? { details } : {}),
  }, { status })
}

async function canWriteProject(projectId: string, userId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true },
  })
  if (!project) return null
  if (project.ownerId === userId) return true
  const access = await getProjectAccess(userId, projectId)
  return access.canWrite
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return jsonError('UNAUTHORIZED', '请先登录。', 401)

  let body: { status?: string; body?: string }
  try {
    body = await request.json() as typeof body
  } catch {
    return jsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
  }

  try {
    const canWrite = await canWriteProject(params.projectId, user.id)
    if (canWrite === null) return jsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)

    const existing = await db.canvasComment.findFirst({
      where: { id: params.commentId, projectId: params.projectId },
      select: { id: true, authorId: true },
    })
    if (!existing) return jsonError('COMMENT_NOT_FOUND', '评论不存在。', 404)
    if (!canWrite && existing.authorId !== user.id) return jsonError('FORBIDDEN', '无权修改该评论。', 403)

    const text = body.body?.trim()
    if (body.body !== undefined && !text) return jsonError('VALIDATION_FAILED', '评论内容不能为空。', 400)
    if (text && text.length > 2000) return jsonError('VALIDATION_FAILED', '评论内容不能超过 2000 字。', 400)

    const comment = await db.canvasComment.update({
      where: { id: params.commentId },
      data: {
        ...(text ? { body: text } : {}),
        ...(body.status ? { status: body.status } : {}),
      },
      select: {
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
      },
    })

    return NextResponse.json({
      success: true,
      comment: {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return jsonError('DB_SCHEMA_MISSING', 'CanvasComment 表未同步，请执行 canvas-comments-setup.sql。', 503)
    }
    const message = error instanceof Error ? error.message : String(error)
    console.error('[canvas-comments-api] update failed', { projectId: params.projectId, commentId: params.commentId, error })
    return jsonError('CANVAS_COMMENT_UPDATE_FAILED', '更新画布评论失败。', 500, message)
  }
}
