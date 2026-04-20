import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { ProjectStatus, ProjectType, ProjectVisibility } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateProjectDto } from './dto/create-project.dto'

type ProjectOwnerWithProfile = {
  id: string
  username: string
  displayName: string
  profile: { avatarUrl: string | null } | null
}

type ProjectMemberWithUser = {
  id: string
  projectId: string
  userId: string
  roleId: string | null
  joinedAt: Date
  leftAt: Date | null
  isActive: boolean
  user: ProjectOwnerWithProfile
  role: { id: string; name: string; permissions: string[]; description: string | null; createdAt: Date } | null
}

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultPhases = [
    { key: 'development', name: 'Development', order: 1 },
    { key: 'pre-production', name: 'Pre-Production', order: 2 },
    { key: 'production', name: 'Production', order: 3 },
    { key: 'post-production', name: 'Post-Production', order: 4 },
    { key: 'distribution', name: 'Distribution', order: 5 },
  ] as const

  private ensureProjectType(type: string): ProjectType {
    return type as ProjectType
  }

  private ensureProjectVisibility(visibility: string): ProjectVisibility {
    return visibility as ProjectVisibility
  }

  private ensureProjectStatus(status: string): ProjectStatus {
    return status as ProjectStatus
  }

  private mapUser(user: ProjectOwnerWithProfile) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.profile?.avatarUrl ?? null,
    }
  }

  private mapCollaborator(member: ProjectMemberWithUser) {
    return {
      id: member.id,
      projectId: member.projectId,
      userId: member.userId,
      role: member.role?.name ?? null,
      permissions: member.role?.permissions ?? [],
      joinedAt: member.joinedAt,
      leftAt: member.leftAt,
      isActive: member.isActive,
      user: this.mapUser(member.user),
    }
  }

  private buildPhases(tasks: Array<{ id: string; title: string; description: string | null; status: string; priority: string; order: number; agentId: string | null; assignedTo: string | null; completedAt: Date | null; createdAt: Date; updatedAt: Date }>) {
    return this.defaultPhases.map((phase) => ({
      id: phase.key,
      name: phase.name,
      order: phase.order,
      tasks: tasks.filter((task) => {
        if (phase.order === 1) return task.order <= 19
        if (phase.order === 2) return task.order >= 20 && task.order <= 39
        if (phase.order === 3) return task.order >= 40 && task.order <= 59
        if (phase.order === 4) return task.order >= 60 && task.order <= 79
        return task.order >= 80
      }),
    }))
  }

  private async ensureProjectRole(roleName: string) {
    return this.prisma.projectRole.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        permissions: ['READ', 'WRITE'],
      },
    })
  }

  async create(userId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: this.ensureProjectType(dto.type),
        visibility: this.ensureProjectVisibility(dto.visibility ?? 'PRIVATE'),
        tags: dto.tags ?? [],
        genre: dto.genre ?? [],
        ownerId: userId,
      },
    })

    return this.findById(project.id, userId)
  }

  async findAll(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId, isActive: true } } },
        ],
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profile: { select: { avatarUrl: true } },
          },
        },
        members: {
          where: { isActive: true },
          include: {
            role: true,
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                profile: { select: { avatarUrl: true } },
              },
            },
          },
        },
        tasks: {
          where: { agentId: { not: null } },
          select: { id: true },
        },
        _count: { select: { assets: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return projects.map((project) => ({
      ...project,
      owner: this.mapUser(project.owner),
      collaborators: project.members.map((member) => this.mapCollaborator(member)),
      _count: {
        assets: project._count.assets,
        agentTasks: project.tasks.length,
      },
    }))
  }

  async findPublic(options: { type?: string; genre?: string; page?: number; limit?: number }) {
    const page = options.page ?? 1
    const limit = Math.min(options.limit ?? 20, 50)
    const skip = (page - 1) * limit

    const where = {
      visibility: 'PUBLIC' as const,
      status: 'PUBLISHED' as const,
      ...(options.type && { type: options.type as never }),
      ...(options.genre && { genre: { has: options.genre } }),
    }

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { views: 'desc' },
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profile: { select: { avatarUrl: true } },
            },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ])

    return {
      items: items.map((item) => ({
        ...item,
        owner: this.mapUser(item.owner),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async findById(id: string, userId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profile: { select: { avatarUrl: true } },
          },
        },
        members: {
          where: { isActive: true },
          include: {
            role: true,
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                profile: { select: { avatarUrl: true } },
              },
            },
          },
        },
        tasks: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    })

    if (!project) throw new NotFoundException('Project not found')

    const isOwner = project.ownerId === userId
    const collaborators = project.members.map((member) => this.mapCollaborator(member))
    const isCollaborator = collaborators.some((collaborator) => collaborator.userId === userId)

    if (project.visibility === 'PRIVATE' && !isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access to this project')
    }

    // Increment view count for public projects
    if (project.visibility === 'PUBLIC' && !isOwner) {
      await this.prisma.project.update({ where: { id }, data: { views: { increment: 1 } } })
    }

    return {
      ...project,
      owner: this.mapUser(project.owner),
      collaborators,
      phases: this.buildPhases(project.tasks),
      agentTasks: project.tasks.filter((task) => task.agentId !== null).slice(0, 10),
    }
  }

  async update(userId: string, id: string, data: Partial<CreateProjectDto> & { status?: string }) {
    const project = await this.prisma.project.findUnique({ where: { id } })
    if (!project) throw new NotFoundException('Project not found')
    if (project.ownerId !== userId) throw new ForbiddenException()

    return this.prisma.project.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.visibility && { visibility: this.ensureProjectVisibility(data.visibility) }),
        ...(data.status && { status: this.ensureProjectStatus(data.status) }),
        ...(data.tags && { tags: data.tags }),
        ...(data.genre && { genre: data.genre }),
      },
    })
  }

  async inviteCollaborator(ownerId: string, projectId: string, userId: string, role: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!project) throw new NotFoundException('Project not found')
    if (project.ownerId !== ownerId) throw new ForbiddenException()

    const projectRole = await this.ensureProjectRole(role)

    return this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: {
        roleId: projectRole.id,
        isActive: true,
        leftAt: null,
      },
      create: {
        projectId,
        userId,
        roleId: projectRole.id,
      },
    })
  }
}
