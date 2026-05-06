import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { ensureOwnerProjectMember } from '@/lib/projects/ensure-active-project'
import {
  PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE,
  isProjectCanvasSchemaMissing,
} from '@/lib/projects/api-errors'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type NewProjectBody = {
  title?: string
  description?: string
  projectType?: string
  source?: string
}

function jsonError(errorCode: string, message: string, status: number) {
  return NextResponse.json({ success: false, errorCode, message }, { status })
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 8)
  const timingLabel = `[projects/new] create ${requestId}`
  console.time(timingLabel)
  console.info('[projects/new] create start', { requestId })

  const user = await getCurrentUser()
  if (!user) {
    console.timeEnd(timingLabel)
    return jsonError('UNAUTHORIZED', '请先登录。', 401)
  }

  let body: NewProjectBody = {}
  try {
    body = await request.json() as NewProjectBody
  } catch {
    body = {}
  }

  const now = new Date()
  const title = body.title?.trim() || 'Untitled Project'
  const description = body.description?.trim() ?? ''

  try {
    const project = await db.project.create({
      data: {
        ownerId: user.id,
        title,
        description,
        type: 'SHORT_FILM',
        status: 'DRAFT',
        visibility: 'PRIVATE',
        tags: [],
        genre: [],
        lastOpenedAt: now,
      },
      select: {
        id: true,
        title: true,
        ownerId: true,
      },
    })
    console.info('[projects/new] project created', { requestId, projectId: project.id })

    const workflow = await db.canvasWorkflow.create({
      data: {
        projectId: project.id,
        name: 'Main Canvas',
        version: 1,
        viewportJson: Prisma.JsonNull,
        metadataJson: Prisma.JsonNull,
      },
      select: {
        id: true,
        projectId: true,
      },
    })
    console.info('[projects/new] workflow created', { requestId, projectId: project.id, workflowId: workflow.id })

    void ensureOwnerProjectMember(project.id, user.id).catch((error: unknown) => {
      console.warn('[projects/new] membership create failed (non-blocking)', error instanceof Error ? error.message : String(error))
    })

    console.info('[projects/new] response', { requestId, projectId: project.id, workflowId: workflow.id })
    console.timeEnd(timingLabel)
    return NextResponse.json({
      success: true,
      project,
      workflow,
      redirectTo: `/create?projectId=${encodeURIComponent(project.id)}`,
    }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    const message = isProjectCanvasSchemaMissing(error)
      ? PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE
      : error instanceof Error ? error.message : '创建项目失败。'
    console.error('[projects/new] create failed', { error })
    console.timeEnd(timingLabel)
    return jsonError('CREATE_PROJECT_FAILED', message, 500)
  }
}
