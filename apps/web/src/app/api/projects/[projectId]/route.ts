import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { getProjectAccess } from '@/lib/projects/ensure-active-project'
import {
  PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE,
  isProjectCanvasSchemaMissing,
  projectJsonError,
} from '@/lib/projects/api-errors'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: { projectId: string }
}

const selectProject = {
  id: true,
  title: true,
  description: true,
  status: true,
  visibility: true,
  thumbnailUrl: true,
  createdAt: true,
  updatedAt: true,
  lastOpenedAt: true,
  ownerId: true,
} as const

async function getAccessibleProject(projectId: string, userId: string, write = false) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: selectProject,
  })
  if (!project) return null
  if (project.ownerId === userId) return project
  const access = await getProjectAccess(userId, projectId)
  if (!access.canRead || (write && !access.canWrite)) return 'FORBIDDEN' as const
  return project
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  try {
    const project = await getAccessibleProject(params.projectId, user.id)
    if (!project) return projectJsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
    if (project === 'FORBIDDEN') return projectJsonError('FORBIDDEN', '无权访问该项目。', 403)
    return NextResponse.json({ project })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return projectJsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    console.error('[projects] failed to load project', error)
    return NextResponse.json({ message: '加载项目失败。' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  let body: { title?: string; description?: string; thumbnailUrl?: string | null } = {}
  try {
    body = await request.json() as typeof body
  } catch {
    return projectJsonError('VALIDATION_FAILED', 'Invalid JSON', 400)
  }

  try {
    const project = await getAccessibleProject(params.projectId, user.id, true)
    if (!project) return projectJsonError('PROJECT_NOT_FOUND', '项目不存在。', 404)
    if (project === 'FORBIDDEN') return projectJsonError('FORBIDDEN', '无权访问该项目。', 403)

    const updated = await db.project.update({
      where: { id: params.projectId },
      data: {
        ...(typeof body.title === 'string' ? { title: body.title.trim() || 'Untitled Project' } : {}),
        ...(typeof body.description === 'string' ? { description: body.description } : {}),
        ...(body.thumbnailUrl !== undefined ? { thumbnailUrl: body.thumbnailUrl } : {}),
        lastOpenedAt: new Date(),
      },
      select: selectProject,
    })

    return NextResponse.json({ project: updated })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return projectJsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    console.error('[projects] failed to update project', error)
    return NextResponse.json({ message: '更新项目失败。' }, { status: 500 })
  }
}
