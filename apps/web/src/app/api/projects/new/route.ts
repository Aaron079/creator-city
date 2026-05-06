import { NextRequest, NextResponse } from 'next/server'
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

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    }),
  ])
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 8)
  console.time('[projects/new] total')
  console.info('[projects/new] create start', { requestId })

  let user: Awaited<ReturnType<typeof getCurrentUser>>
  console.time('[projects/new] auth')
  try {
    user = await withTimeout(getCurrentUser(), 10_000, 'auth')
    if (!user) {
      console.timeEnd('[projects/new] total')
      return jsonError('UNAUTHORIZED', '请先登录。', 401)
    }
  } catch (error) {
    const message = safeMessage(error)
    console.error('[projects/new] auth failed', { requestId, message })
    console.timeEnd('[projects/new] total')
    return jsonError(
      'CREATE_PROJECT_FAILED',
      message,
      500,
    )
  } finally {
    console.timeEnd('[projects/new] auth')
  }

  let body: NewProjectBody = {}
  try {
    body = await request.json() as NewProjectBody
  } catch {
    body = {}
  }

  const now = new Date()
  const projectId = crypto.randomUUID()
  const workflowId = crypto.randomUUID()
  const title = body.title?.trim() || 'Untitled Project'
  const description = body.description?.trim() ?? ''

  try {
    console.time('[projects/new] insert project')
    try {
      await withTimeout(db.$executeRaw`
        insert into "Project" (
          "id",
          "ownerId",
          "title",
          "description",
          "type",
          "status",
          "visibility",
          "tags",
          "genre",
          "createdAt",
          "updatedAt",
          "lastOpenedAt"
        )
        values (
          ${projectId},
          ${user.id},
          ${title},
          ${description},
          'SHORT_FILM'::"ProjectType",
          'DRAFT'::"ProjectStatus",
          'PRIVATE'::"ProjectVisibility",
          ARRAY[]::text[],
          ARRAY[]::text[],
          ${now},
          ${now},
          ${now}
        )
      `, 15_000, 'insert project')
    } finally {
      console.timeEnd('[projects/new] insert project')
    }
    console.info('[projects/new] project created', { requestId, projectId })

    try {
      console.time('[projects/new] insert workflow')
      await withTimeout(db.$executeRaw`
        insert into "CanvasWorkflow" (
          "id",
          "projectId",
          "name",
          "version",
          "viewportJson",
          "metadataJson",
          "createdAt",
          "updatedAt"
        )
        values (
          ${workflowId},
          ${projectId},
          'Main Canvas',
          1,
          NULL,
          NULL,
          ${now},
          ${now}
        )
      `, 15_000, 'insert workflow')
      console.timeEnd('[projects/new] insert workflow')
    } catch (workflowError) {
      console.timeEnd('[projects/new] insert workflow')
      console.warn('[projects/new] workflow insert failed, retrying once', { requestId, projectId, message: safeMessage(workflowError) })
      await withTimeout(db.$executeRaw`
        insert into "CanvasWorkflow" (
          "id",
          "projectId",
          "name",
          "version",
          "viewportJson",
          "metadataJson",
          "createdAt",
          "updatedAt"
        )
        values (
          ${workflowId},
          ${projectId},
          'Main Canvas',
          1,
          NULL,
          NULL,
          ${now},
          ${now}
        )
        on conflict ("id") do nothing
      `, 15_000, 'retry insert workflow')
    }
    console.info('[projects/new] workflow created', { requestId, projectId, workflowId })

    void ensureOwnerProjectMember(projectId, user.id).catch((error: unknown) => {
      console.warn('[projects/new] membership skipped', safeMessage(error))
    })

    console.time('[projects/new] response')
    const response = NextResponse.json({
      success: true,
      project: {
        id: projectId,
        title,
        ownerId: user.id,
      },
      workflow: {
        id: workflowId,
        projectId,
      },
      redirectTo: `/create?projectId=${encodeURIComponent(projectId)}`,
    }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
    console.info('[projects/new] response', { requestId, projectId, workflowId })
    console.timeEnd('[projects/new] response')
    return response
  } catch (error) {
    const schemaMissing = isProjectCanvasSchemaMissing(error)
    const message = schemaMissing
      ? PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE
      : safeMessage(error) || '创建项目失败。'
    console.error('[projects/new] create failed', { requestId, error })
    return jsonError(
      schemaMissing ? 'DB_SCHEMA_MISSING' : 'CREATE_PROJECT_FAILED',
      message,
      schemaMissing ? 503 : 500,
    )
  } finally {
    console.timeEnd('[projects/new] total')
  }
}
