import type { Prisma, ProjectStatus, ProjectVisibility } from '@prisma/client'
import type { CurrentUser } from '@/lib/auth/current-user'
import { db } from '@/lib/db'

const MAIN_CANVAS_VIEWPORT = { zoom: 1, pan: { x: 0, y: 0 } }
const OWNER_ROLE_ID = 'OWNER'
const OWNER_ROLE_NAME = 'OWNER'

const projectSelect = {
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
} satisfies Prisma.ProjectSelect

const workflowSelect = {
  id: true,
  projectId: true,
  name: true,
  viewportJson: true,
  metadataJson: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CanvasWorkflowSelect

type ProjectWithWorkflow = Prisma.ProjectGetPayload<{
  select: typeof projectSelect & {
    canvasWorkflows: {
      take: 1
      orderBy: { createdAt: 'asc' }
      select: typeof workflowSelect
    }
  }
}>

export interface ActiveProjectResult {
  project: Prisma.ProjectGetPayload<{ select: typeof projectSelect }>
  workflow: Prisma.CanvasWorkflowGetPayload<{ select: typeof workflowSelect }>
  membershipWarning?: string
}

export interface ProjectAccess {
  canRead: boolean
  canWrite: boolean
  role: string | null
  source: 'owner' | 'member' | 'none'
}

function normalizeMembershipWarning(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return `ProjectMember sync skipped: ${message}`
}

async function ensureOwnerProjectMember(projectId: string, userId: string) {
  try {
    const role = await db.projectRole.upsert({
      where: { name: OWNER_ROLE_NAME },
      create: {
        id: OWNER_ROLE_ID,
        name: OWNER_ROLE_NAME,
        permissions: ['project:read', 'project:write', 'canvas:read', 'canvas:write', 'member:manage'],
        description: 'Project owner',
      },
      update: {
        permissions: ['project:read', 'project:write', 'canvas:read', 'canvas:write', 'member:manage'],
      },
      select: { id: true },
    })

    await db.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: {
        projectId,
        userId,
        roleId: role.id,
        isActive: true,
      },
      update: {
        roleId: role.id,
        isActive: true,
        leftAt: null,
      },
    })
    return undefined
  } catch (error) {
    const warning = normalizeMembershipWarning(error)
    console.warn('[projects] owner ProjectMember sync failed', { projectId, userId, error })
    return warning
  }
}

async function ensureWorkflow(projectId: string) {
  const existing = await db.canvasWorkflow.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    select: workflowSelect,
  })
  if (existing) return existing

  return db.canvasWorkflow.create({
    data: {
      projectId,
      name: 'Main Canvas',
      viewportJson: MAIN_CANVAS_VIEWPORT,
    },
    select: workflowSelect,
  })
}

export async function createProjectForUser(
  user: CurrentUser,
  input: { title?: string; description?: string } = {},
): Promise<ActiveProjectResult> {
  const now = new Date()
  const title = input.title?.trim() || 'Untitled Project'
  const description = input.description ?? ''

  const result = await db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        ownerId: user.id,
        title,
        description,
        type: 'SHORT_FILM',
        status: 'DRAFT' as ProjectStatus,
        visibility: 'PRIVATE' as ProjectVisibility,
        tags: [],
        genre: [],
        lastOpenedAt: now,
      },
      select: projectSelect,
    })
    const workflow = await tx.canvasWorkflow.create({
      data: {
        projectId: project.id,
        name: 'Main Canvas',
        viewportJson: MAIN_CANVAS_VIEWPORT,
      },
      select: workflowSelect,
    })
    return { project, workflow }
  })

  const membershipWarning = await ensureOwnerProjectMember(result.project.id, user.id)
  return { ...result, ...(membershipWarning ? { membershipWarning } : {}) }
}

export async function ensureActiveProject(user: CurrentUser): Promise<ActiveProjectResult> {
  let membershipWarning: string | undefined

  const ownedProject = await db.project.findFirst({
    where: { ownerId: user.id },
    select: {
      ...projectSelect,
      canvasWorkflows: {
        take: 1,
        orderBy: { createdAt: 'asc' },
        select: workflowSelect,
      },
    },
    orderBy: [{ lastOpenedAt: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
  })

  let existing: ProjectWithWorkflow | null = ownedProject

  if (!existing) {
    try {
      const membership = await db.projectMember.findFirst({
        where: { userId: user.id, isActive: true, leftAt: null },
        select: {
          project: {
            select: {
              ...projectSelect,
              canvasWorkflows: {
                take: 1,
                orderBy: { createdAt: 'asc' },
                select: workflowSelect,
              },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      })
      existing = membership?.project ?? null
    } catch (error) {
      membershipWarning = normalizeMembershipWarning(error)
      console.warn('[projects] active membership lookup failed', { userId: user.id, error })
    }
  }

  if (!existing) return createProjectForUser(user)

  const workflow = existing.canvasWorkflows[0] ?? await ensureWorkflow(existing.id)
  const openedAt = new Date()
  await db.project.update({
    where: { id: existing.id },
    data: { lastOpenedAt: openedAt },
    select: { id: true },
  })

  return {
    project: {
      id: existing.id,
      title: existing.title,
      description: existing.description,
      status: existing.status,
      visibility: existing.visibility,
      thumbnailUrl: existing.thumbnailUrl,
      ownerId: existing.ownerId,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
      lastOpenedAt: openedAt,
    },
    workflow,
    ...(membershipWarning ? { membershipWarning } : {}),
  }
}

export async function getProjectAccess(userId: string, projectId: string): Promise<ProjectAccess> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true },
  })
  if (!project) return { canRead: false, canWrite: false, role: null, source: 'none' }

  if (project.ownerId === userId) {
    return { canRead: true, canWrite: true, role: OWNER_ROLE_NAME, source: 'owner' }
  }

  try {
    const membership = await db.projectMember.findFirst({
      where: { projectId, userId, isActive: true, leftAt: null },
      select: {
        roleId: true,
        role: { select: { name: true, permissions: true } },
      },
    })
    if (!membership) return { canRead: false, canWrite: false, role: null, source: 'none' }

    const role = membership.role?.name ?? membership.roleId ?? 'MEMBER'
    const permissions = membership.role?.permissions ?? []
    const canWrite = role === OWNER_ROLE_NAME
      || role === 'PRODUCER'
      || permissions.includes('project:write')
      || permissions.includes('canvas:write')

    return { canRead: true, canWrite, role, source: 'member' }
  } catch (error) {
    console.warn('[projects] ProjectMember access lookup failed', { userId, projectId, error })
    return { canRead: false, canWrite: false, role: null, source: 'none' }
  }
}
