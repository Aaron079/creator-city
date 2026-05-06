import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { ensureOwnerProjectMember } from '@/lib/projects/ensure-active-project'
import {
  PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE,
  isProjectCanvasSchemaMissing,
  projectJsonError,
} from '@/lib/projects/api-errors'

export const dynamic = 'force-dynamic'

const MAIN_CANVAS_VIEWPORT = { zoom: 1, pan: { x: 0, y: 0 } }

function projectSelect() {
  return {
    id: true,
    title: true,
    description: true,
    status: true,
    visibility: true,
    thumbnailUrl: true,
    ownerId: true,
    createdAt: true,
    updatedAt: true,
    lastOpenedAt: true,
    canvasWorkflows: {
      take: 1,
      orderBy: { createdAt: 'asc' as const },
      select: {
        id: true,
        _count: { select: { nodes: true } },
      },
    },
  } as const
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  try {
    const ownedProjects = await db.project.findMany({
      where: { ownerId: user.id },
      select: projectSelect(),
      orderBy: [{ lastOpenedAt: 'desc' }, { updatedAt: 'desc' }],
    })
    let memberProjects: Awaited<typeof ownedProjects> = []
    const membershipByProjectId = new Map<string, string | null>()
    let membershipWarning: string | undefined
    try {
      const activeMemberships = await db.projectMember.findMany({
        where: { userId: user.id, isActive: true, leftAt: null },
        select: {
          projectId: true,
          roleId: true,
          role: { select: { name: true } },
        },
      })
      for (const membership of activeMemberships) {
        membershipByProjectId.set(membership.projectId, membership.role?.name ?? membership.roleId ?? null)
      }
      memberProjects = await db.project.findMany({
        where: {
          members: {
            some: { userId: user.id, isActive: true, leftAt: null },
          },
        },
        select: projectSelect(),
        orderBy: [{ lastOpenedAt: 'desc' }, { updatedAt: 'desc' }],
      })
    } catch (error) {
      membershipWarning = error instanceof Error ? error.message : String(error)
      console.warn('[projects] member project lookup failed', { userId: user.id, error })
    }

    const byId = new Map<string, (typeof ownedProjects)[number]>()
    for (const project of [...ownedProjects, ...memberProjects]) byId.set(project.id, project)

    const projects = [...byId.values()]
      .sort((left, right) => {
        const leftTime = new Date(left.lastOpenedAt ?? left.updatedAt).getTime()
        const rightTime = new Date(right.lastOpenedAt ?? right.updatedAt).getTime()
        return rightTime - leftTime
      })
      .map((project) => {
        const workflow = project.canvasWorkflows[0]
        const isOwner = project.ownerId === user.id
        return {
          id: project.id,
          title: project.title,
          description: project.description,
          status: project.status,
          visibility: project.visibility,
          thumbnailUrl: project.thumbnailUrl,
          ownerId: project.ownerId,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          lastOpenedAt: project.lastOpenedAt,
          workflowId: workflow?.id ?? null,
          nodeCount: workflow?._count.nodes ?? 0,
          ownerRole: isOwner ? 'OWNER' : null,
          membershipRole: membershipByProjectId.get(project.id) ?? null,
        }
      })

    return NextResponse.json({
      projects,
      summary: {
        ownedProjectsCount: ownedProjects.length,
        activeMembershipsCount: membershipByProjectId.size,
        currentProjectId: projects[0]?.id ?? null,
        recentProject: projects[0] ?? null,
      },
      ...(membershipWarning ? { membershipWarning } : {}),
    })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return projectJsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    console.error('[projects] failed to list projects', error)
    return NextResponse.json({ message: '加载项目列表失败。' }, { status: 500 })
  }
}

type ProjectCreateBody = {
  title?: string
  description?: string
  templateId?: string
  projectType?: 'blank' | 'video' | 'image' | 'text' | 'template'
  source?: string
}

const PROJECT_TYPES = new Set(['blank', 'video', 'image', 'text', 'template'])

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return projectJsonError('UNAUTHORIZED', '请先登录。', 401)

  let body: ProjectCreateBody = {}
  try {
    body = await request.json() as typeof body
  } catch {
    body = {}
  }

  if (body.projectType && !PROJECT_TYPES.has(body.projectType)) {
    return projectJsonError('VALIDATION_FAILED', '项目类型无效。', 400)
  }

  const title = body.title?.trim() || 'Untitled Project'
  const description = body.description?.trim() ?? ''
  const now = new Date()

  try {
    // Step 1: create Project — no $transaction to stay compatible with pgBouncer
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
        description: true,
        status: true,
        visibility: true,
        thumbnailUrl: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        lastOpenedAt: true,
      },
    })

    // Step 2: create CanvasWorkflow
    const workflow = await db.canvasWorkflow.create({
      data: {
        projectId: project.id,
        name: 'Main Canvas',
        viewportJson: MAIN_CANVAS_VIEWPORT,
      },
      select: {
        id: true,
        projectId: true,
        name: true,
        viewportJson: true,
        metadataJson: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Step 3: best-effort ProjectMember — fire and forget, never blocks the response
    void ensureOwnerProjectMember(project.id, user.id).catch((e: unknown) => {
      console.warn('[projects] membership create failed (non-blocking)',
        e instanceof Error ? e.message : String(e))
    })

    return NextResponse.json({
      success: true,
      project,
      workflow,
      redirectTo: `/create?projectId=${encodeURIComponent(project.id)}`,
    }, { status: 201 })
  } catch (error) {
    if (isProjectCanvasSchemaMissing(error)) {
      return projectJsonError('DB_SCHEMA_MISSING', PROJECT_CANVAS_SCHEMA_MISSING_MESSAGE, 503)
    }
    const safeMessage = error instanceof Error ? error.message : '创建项目失败。'
    console.error('[projects] failed to create project', error)
    return projectJsonError('CREATE_PROJECT_FAILED', safeMessage, 500)
  }
}
