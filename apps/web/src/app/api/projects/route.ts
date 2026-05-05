import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import {
  PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE,
  isProjectCanvasSchemaMissing,
  projectJsonError,
} from '@/lib/projects/api-errors'

export const dynamic = 'force-dynamic'

function projectSelect() {
  return {
    id: true,
    title: true,
    description: true,
    status: true,
    visibility: true,
    thumbnailUrl: true,
    createdAt: true,
    updatedAt: true,
    lastOpenedAt: true,
  } as const
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  try {
    const projects = await db.project.findMany({
      where: { ownerId: user.id },
      select: projectSelect(),
      orderBy: [{ lastOpenedAt: 'desc' }, { updatedAt: 'desc' }],
    })
    return NextResponse.json({ projects })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return projectJsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    console.error('[projects] failed to list projects', error)
    return NextResponse.json({ message: '加载项目列表失败。' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  let body: { title?: string; description?: string } = {}
  try {
    body = await request.json() as typeof body
  } catch {
    body = {}
  }

  const now = new Date()
  const title = body.title?.trim() || 'Untitled Project'

  try {
    const result = await db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          ownerId: user.id,
          title,
          description: body.description ?? '',
          type: 'SHORT_FILM',
          status: 'DRAFT',
          visibility: 'PRIVATE',
          tags: [],
          genre: [],
          lastOpenedAt: now,
        },
        select: projectSelect(),
      })
      const workflow = await tx.canvasWorkflow.create({
        data: {
          projectId: project.id,
          name: 'Main Canvas',
          viewportJson: { zoom: 1, pan: { x: 0, y: 0 } },
        },
      })
      return { project, workflow }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return projectJsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    console.error('[projects] failed to create project', error)
    return NextResponse.json({ message: '创建项目失败。' }, { status: 500 })
  }
}
