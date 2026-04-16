import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'

export interface CreateProjectDto {
  title: string
  description: string
  type: string
  visibility?: string
  tags?: string[]
  genre?: string[]
  budgetTotal?: number
  deadline?: string
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type as never,
        visibility: (dto.visibility ?? 'PRIVATE') as never,
        tags: dto.tags ?? [],
        genre: dto.genre ?? [],
        budgetTotal: dto.budgetTotal ?? 0,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        ownerId: userId,
        members: {
          create: { userId, isActive: true }, // owner is always a member
        },
        tasks: {
          create: [
            { title: 'Development', order: 1 },
            { title: 'Pre-Production', order: 2 },
            { title: 'Production', order: 3 },
            { title: 'Post-Production', order: 4 },
          ],
        },
      },
      include: { members: true, tasks: true },
    })
    return project
  }

  async findById(id: string, requestUserId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, username: true, displayName: true } },
        members: {
          where: { isActive: true },
          include: {
            user: { select: { id: true, username: true, displayName: true } },
            role: true,
          },
        },
        tasks: { orderBy: { order: 'asc' } },
        reviews: {
          where: { isPublic: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { assets: true, showcases: true } },
      },
    })
    if (!project) throw new NotFoundException('Project not found')

    const isMember = project.members.some((m) => m.userId === requestUserId)
    const isOwner = project.ownerId === requestUserId

    if (project.visibility === 'PRIVATE' && !isOwner && !isMember) {
      throw new ForbiddenException('Access denied')
    }

    if (!isOwner) {
      await this.prisma.project.update({ where: { id }, data: { views: { increment: 1 } } })
    }

    return project
  }

  async findMyProjects(userId: string) {
    return this.prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId, isActive: true } } },
        ],
      },
      include: {
        owner: { select: { id: true, username: true, displayName: true } },
        _count: { select: { members: true, tasks: true, assets: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async update(userId: string, id: string, data: Partial<CreateProjectDto> & { status?: string }) {
    const project = await this.prisma.project.findUnique({ where: { id } })
    if (!project) throw new NotFoundException()
    if (project.ownerId !== userId) throw new ForbiddenException()

    return this.prisma.project.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.visibility && { visibility: data.visibility as never }),
        ...(data.status && { status: data.status as never }),
        ...(data.tags && { tags: data.tags }),
        ...(data.genre && { genre: data.genre }),
        ...(data.deadline && { deadline: new Date(data.deadline) }),
      },
    })
  }

  // ─── Members & Invites ─────────────────────────────────────────────────────

  async getMembers(projectId: string, requestUserId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!project) throw new NotFoundException()

    const isMember = await this.prisma.projectMember.findFirst({
      where: { projectId, userId: requestUserId, isActive: true },
    })
    if (project.visibility === 'PRIVATE' && !isMember && project.ownerId !== requestUserId) {
      throw new ForbiddenException()
    }

    return this.prisma.projectMember.findMany({
      where: { projectId, isActive: true },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        role: true,
      },
    })
  }

  async invite(ownerId: string, projectId: string, toUserId: string, message?: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!project) throw new NotFoundException()
    if (project.ownerId !== ownerId) throw new ForbiddenException()

    const existing = await this.prisma.invitation.findFirst({
      where: { projectId, toId: toUserId, status: 'PENDING' },
    })
    if (existing) throw new ConflictException('Invitation already pending')

    const invitation = await this.prisma.invitation.create({
      data: {
        fromId: ownerId,
        toId: toUserId,
        projectId,
        message,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    })

    await this.notifications.create(toUserId, 'INVITATION', {
      title: 'Project Invitation',
      body: `You have been invited to join "${project.title}"`,
      data: { projectId, invitationId: invitation.id },
    })

    return invitation
  }

  async acceptInvitation(userId: string, invitationId: string) {
    const inv = await this.prisma.invitation.findUnique({ where: { id: invitationId } })
    if (!inv) throw new NotFoundException()
    if (inv.toId !== userId) throw new ForbiddenException()
    if (inv.status !== 'PENDING') throw new ConflictException('Invitation is no longer pending')

    const [, member] = await this.prisma.$transaction([
      this.prisma.invitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED' },
      }),
      this.prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: inv.projectId, userId } },
        update: { isActive: true, leftAt: null },
        create: { projectId: inv.projectId, userId, roleId: inv.roleId },
      }),
    ])

    return member
  }

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  async createTask(
    userId: string,
    projectId: string,
    data: { title: string; description?: string; priority?: string; dueDate?: string },
  ) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    })
    if (!member) throw new ForbiddenException('Not a project member')

    const count = await this.prisma.projectTask.count({ where: { projectId } })

    return this.prisma.projectTask.create({
      data: {
        projectId,
        title: data.title,
        description: data.description,
        priority: (data.priority ?? 'MEDIUM') as never,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        order: count + 1,
      },
    })
  }

  async updateTask(userId: string, taskId: string, data: {
    title?: string
    status?: string
    priority?: string
    assignedTo?: string
  }) {
    const task = await this.prisma.projectTask.findUnique({
      where: { id: taskId },
      include: { project: true },
    })
    if (!task) throw new NotFoundException()

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: task.projectId, userId } },
    })
    if (!member && task.project.ownerId !== userId) throw new ForbiddenException()

    return this.prisma.projectTask.update({
      where: { id: taskId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.status && { status: data.status as never }),
        ...(data.priority && { priority: data.priority as never }),
        ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
        ...(data.status === 'DONE' && { completedAt: new Date() }),
      },
    })
  }

  // ─── Reviews ───────────────────────────────────────────────────────────────

  async addReview(userId: string, projectId: string, rating: number, comment?: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!project) throw new NotFoundException()
    if (project.ownerId === userId) throw new ForbiddenException('Cannot review your own project')

    const review = await this.prisma.projectReview.upsert({
      where: { projectId_reviewerId: { projectId, reviewerId: userId } },
      update: { rating, comment },
      create: { projectId, reviewerId: userId, rating, comment },
    })

    // Recalculate average rating
    const { _avg, _count } = await this.prisma.projectReview.aggregate({
      where: { projectId },
      _avg: { rating: true },
      _count: { id: true },
    })

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        rating: _avg.rating ?? 0,
        ratingCount: _count.id,
      },
    })

    return review
  }
}
